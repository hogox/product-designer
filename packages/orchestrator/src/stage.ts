// Orquestador mínimo (PRD §9): enruta, no diseña. Routing de DOS etapas del diamante
// Problema: Descubrimiento (Agente 1 → hallazgos) → triage humano → Definición (Agente 2
// → propuesta) → compuerta enmarcar. BLOQUEA hasta aprobación humana; NUNCA sube versión
// sin aprobación; registra todo en auditoría.

import { rm } from "node:fs/promises";

import {
  readSpec,
  writeSpec,
  writeProposedSpec,
  readProposedSpec,
  writeFindings,
  readFindings,
  commitSpec,
  appendAudit,
  specPaths,
  type Finding,
  type GitAuthor,
  type Spec,
  type VerificationCriterion,
} from "@pda/spec";

import { automatedVerification, blockingPasses } from "./verify.js";

/** Agente 1 (Descubrimiento): produce hallazgos anclados. Inyectable (real o stub). */
export interface DiscoveryRunner {
  run(current: Spec): Promise<{ findings: Finding[] }>;
}

/** Agente 2 (Definición): produce la propuesta v+1 desde los hallazgos validados. */
export interface DefinitionRunner {
  run(current: Spec, findings: Finding[]): Promise<{ proposed: Spec }>;
}

export interface DiscoveryResult {
  specId: string;
  stage: "descubrimiento";
  findings: Finding[];
  verification: VerificationCriterion[];
}

export interface PendingGate {
  specId: string;
  gate: string; // "enmarcar"
  current: Spec;
  proposed: Spec;
  verification: VerificationCriterion[];
  blocked: true;
}

export interface StageState {
  specId: string;
  version: number;
  status: Spec["status"];
  stage: Spec["current_stage"];
  findings: number;
  hasProposal: boolean;
}

const now = (): string => new Date().toISOString();

/** Estado actual de la spec (derivado de los archivos del almacén). */
export async function getState(
  rootDir: string,
  specId: string,
): Promise<StageState> {
  const spec = await readSpec(rootDir, specId);
  let hasProposal = false;
  try {
    await readProposedSpec(rootDir, specId);
    hasProposal = true;
  } catch {
    hasProposal = false;
  }
  const findings = await readFindings(rootDir, specId);
  return {
    specId,
    version: spec.version,
    status: spec.status,
    stage: spec.current_stage,
    findings: findings.length,
    hasProposal,
  };
}

/**
 * Etapa 1 — DESCUBRIMIENTO (Agente 1): produce hallazgos anclados, los persiste, verifica
 * y audita. No propone spec ni gatea: los hallazgos quedan para el triage humano.
 */
export async function runDiscovery(
  rootDir: string,
  specId: string,
  opts: { runner: DiscoveryRunner; actor?: string; author?: GitAuthor },
): Promise<DiscoveryResult> {
  const current = await readSpec(rootDir, specId);
  await appendAudit(rootDir, {
    actor: opts.actor ?? "orchestrator",
    action: "stage.start",
    spec_id: specId,
    reason: "etapa descubrimiento",
  });

  const { findings } = await opts.runner.run(current);
  await writeFindings(rootDir, specId, findings);
  const verification = automatedVerification(findings);

  await appendAudit(rootDir, {
    actor: "agent1",
    action: "agent.proposed",
    spec_id: specId,
    reason: `${findings.length} hallazgos (descubrimiento); verificación ${blockingPasses(verification) ? "OK" : "FALLA"}`,
  });

  await commitSpec(
    rootDir,
    specId,
    `Agente 1 (Descubrimiento) propone ${findings.length} hallazgos de '${specId}'`,
    opts.author,
  );

  return { specId, stage: "descubrimiento", findings, verification };
}

/**
 * Etapa 2 — DEFINICIÓN (Agente 2): toma los hallazgos validados, produce la propuesta v+1
 * (problem statement + JTBD + métricas), verifica, persiste, audita y BLOQUEA en el gate.
 */
export async function runDefinition(
  rootDir: string,
  specId: string,
  opts: { runner: DefinitionRunner; actor?: string; author?: GitAuthor },
): Promise<PendingGate> {
  const current = await readSpec(rootDir, specId);
  const findings = await readFindings(rootDir, specId);
  if (findings.length === 0) {
    throw new Error(
      "no hay hallazgos validados; corré Descubrimiento (discover) primero",
    );
  }

  await appendAudit(rootDir, {
    actor: opts.actor ?? "orchestrator",
    action: "stage.start",
    spec_id: specId,
    reason: "etapa definicion",
  });

  const { proposed: raw } = await opts.runner.run(current, findings);
  const verification = automatedVerification(raw.findings);
  const proposed: Spec = { ...raw, verification };

  await writeProposedSpec(rootDir, proposed);
  await writeFindings(rootDir, specId, proposed.findings);

  await appendAudit(rootDir, {
    actor: "agent2",
    action: "agent.proposed",
    spec_id: specId,
    reason: `definición: ${proposed.jtbd.length} JTBD, ${proposed.outcomes.length} métricas; verificación ${blockingPasses(verification) ? "OK" : "FALLA"}`,
  });

  await commitSpec(
    rootDir,
    specId,
    `Agente 2 (Definición) propone v+1 de '${specId}' (pendiente de compuerta)`,
    opts.author,
  );

  return {
    specId,
    gate: "enmarcar",
    current,
    proposed,
    verification,
    blocked: true,
  };
}

/** Micro-validación: rechaza un hallazgo con motivo (invariante 7); lo quita del store. */
export async function rejectFinding(
  rootDir: string,
  specId: string,
  findingId: string,
  opts: { reason: string; actor: string },
): Promise<Finding[]> {
  const findings = await readFindings(rootDir, specId);
  const remaining = findings.filter((f) => f.id !== findingId);
  await writeFindings(rootDir, specId, remaining);

  // si ya hay una propuesta de Definición, mantenerla consistente
  try {
    const proposed = await readProposedSpec(rootDir, specId);
    const updated: Spec = {
      ...proposed,
      findings: proposed.findings.filter((f) => f.id !== findingId),
    };
    updated.verification = automatedVerification(updated.findings);
    await writeProposedSpec(rootDir, updated);
  } catch {
    // no hay propuesta todavía (estamos en triage de descubrimiento): ok
  }

  await appendAudit(rootDir, {
    actor: opts.actor,
    action: "finding.reject",
    spec_id: specId,
    target: findingId,
    reason: opts.reason,
  });
  return remaining;
}

/**
 * Compuerta enmarcar — APROBAR: sube de versión, registra en history y commitea. Rechaza la
 * aprobación si algún criterio bloqueante falla (nunca aprueba una spec sin verificar).
 */
export async function approveGate(
  rootDir: string,
  specId: string,
  opts: { approver: string; author?: GitAuthor; gate?: string },
): Promise<Spec> {
  const gate = opts.gate ?? "enmarcar";
  const proposed = await readProposedSpec(rootDir, specId);
  const verification = automatedVerification(proposed.findings);

  if (!blockingPasses(verification)) {
    await appendAudit(rootDir, {
      actor: opts.approver,
      action: "gate.blocked",
      spec_id: specId,
      reason: "criterios bloqueantes sin pasar; aprobación rechazada",
    });
    throw new Error(
      "No se puede aprobar: hay criterios de verificación bloqueantes sin pasar",
    );
  }

  const version = proposed.version + 1;
  const next: Spec = {
    ...proposed,
    version,
    status: "approved",
    current_stage: "definicion",
    verification,
    history: [
      ...proposed.history,
      {
        version,
        stage: "definicion",
        proposed_by: "agent2",
        change_summary: `Compuerta '${gate}' aprobada: problem statement + JTBD + métricas`,
        approved_by: opts.approver,
        timestamp: now(),
      },
    ],
  };

  await writeSpec(rootDir, next);
  await rm(specPaths(rootDir, specId).proposed, { force: true });

  await appendAudit(rootDir, {
    actor: opts.approver,
    action: "gate.approve",
    spec_id: specId,
    reason: `compuerta '${gate}' → v${version}`,
  });

  await commitSpec(
    rootDir,
    specId,
    `Compuerta '${gate}' aprobada por ${opts.approver} → v${version} de '${specId}'`,
    opts.author,
  );

  return next;
}

/** Compuerta — ITERAR: registra el feedback (el agente re-corre con él como input). */
export async function iterateGate(
  rootDir: string,
  specId: string,
  opts: { feedback: string; actor: string },
): Promise<void> {
  await appendAudit(rootDir, {
    actor: opts.actor,
    action: "gate.iterate",
    spec_id: specId,
    reason: opts.feedback,
  });
}
