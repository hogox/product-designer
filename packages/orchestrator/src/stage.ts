// Orquestador mínimo (PRD §9): enruta, no diseña. Mantiene estado de la spec, corre el
// agente de UNA etapa, dispara verificación, lleva al gate (BLOQUEA hasta aprobación
// humana) y registra todo en auditoría. NUNCA sube versión sin aprobación.

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

/** Produce una propuesta de etapa (el agente). Inyectable: real (agent1) o stub (tests). */
export interface DiscoveryRunner {
  run(current: Spec): Promise<{ findings: Finding[]; proposed: Spec }>;
}

export interface PendingGate {
  specId: string;
  gate: string; // "enmarcar"
  current: Spec;
  proposed: Spec;
  verification: VerificationCriterion[];
  blocked: true; // el avance está bloqueado hasta aprobación humana
}

export interface StageState {
  specId: string;
  version: number;
  status: Spec["status"];
  stage: Spec["current_stage"];
  hasProposal: boolean;
  findings: number;
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
    hasProposal,
    findings: findings.length,
  };
}

/**
 * Corre la etapa de Descubrimiento: agente → verificación → persiste propuesta + findings →
 * audita → BLOQUEA en el gate. No sube versión.
 */
export async function runStage(
  rootDir: string,
  specId: string,
  opts: { runner: DiscoveryRunner; actor?: string; author?: GitAuthor },
): Promise<PendingGate> {
  const actor = opts.actor ?? "orchestrator";
  const current = await readSpec(rootDir, specId);

  await appendAudit(rootDir, {
    actor,
    action: "stage.start",
    spec_id: specId,
    reason: `etapa ${current.current_stage}`,
  });

  const { findings, proposed: rawProposed } = await opts.runner.run(current);
  const verification = automatedVerification(findings);
  const proposed: Spec = { ...rawProposed, verification };

  await writeFindings(rootDir, specId, findings);
  await writeProposedSpec(rootDir, proposed);

  await appendAudit(rootDir, {
    actor: "agent1",
    action: "agent.proposed",
    spec_id: specId,
    reason: `${findings.length} hallazgos; verificación ${blockingPasses(verification) ? "OK" : "FALLA"}`,
  });

  await commitSpec(
    rootDir,
    specId,
    `Agente 1 propone v+1 de '${specId}' (pendiente de compuerta)`,
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

/** Micro-validación: rechaza un hallazgo con motivo (invariante 7); lo quita de la propuesta. */
export async function rejectFinding(
  rootDir: string,
  specId: string,
  findingId: string,
  opts: { reason: string; actor: string },
): Promise<Spec> {
  const proposed = await readProposedSpec(rootDir, specId);
  const remaining = proposed.findings.filter((f) => f.id !== findingId);
  const updated: Spec = {
    ...proposed,
    findings: remaining,
    verification: automatedVerification(remaining),
  };
  await writeProposedSpec(rootDir, updated);
  await writeFindings(rootDir, specId, remaining);
  await appendAudit(rootDir, {
    actor: opts.actor,
    action: "finding.reject",
    spec_id: specId,
    target: findingId,
    reason: opts.reason,
  });
  return updated;
}

/**
 * Compuerta — APROBAR: sube de versión, registra en history y commitea. Rechaza la
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
        proposed_by: "agent1",
        change_summary: `Compuerta '${gate}' aprobada: problem statement + outcomes tentativos`,
        approved_by: opts.approver,
        timestamp: now(),
      },
    ],
  };

  await writeSpec(rootDir, next);
  // la propuesta queda consumida
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
