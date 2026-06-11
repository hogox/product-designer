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
  writeConcepts,
  readConcepts,
  commitSpec,
  appendAudit,
  readAudit,
  specPaths,
  type Concept,
  type Finding,
  type GitAuthor,
  type ReviewStatus,
  type Spec,
  type VerificationCriterion,
} from "@pda/spec";

import {
  automatedVerification,
  verifyProposal,
  blockingPasses,
} from "./verify.js";

/** Agente 1 (Descubrimiento): produce hallazgos anclados. Inyectable (real o stub). */
export interface DiscoveryRunner {
  run(current: Spec): Promise<{ findings: Finding[] }>;
}

/** Agente 2 (Definición): produce la propuesta v+1 desde los hallazgos validados. */
export interface DefinitionRunner {
  run(current: Spec, findings: Finding[], feedback?: string): Promise<{ proposed: Spec }>;
}

/** Agente 3 (Exploración): produce conceptos de solución anclados a los JTBD. Inyectable. */
export interface ExplorationRunner {
  run(
    current: Spec,
    discardedFeedback?: string,
  ): Promise<{ concepts: Concept[] }>;
}

export interface DiscoveryResult {
  specId: string;
  stage: "descubrimiento";
  findings: Finding[];
  verification: VerificationCriterion[];
}

export interface ExplorationResult {
  specId: string;
  stage: "exploracion";
  concepts: Concept[];
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

  // Feedback de iteración: el último gate.iterate posterior al último agent.proposed.
  const auditLog = await readAudit(rootDir, specId);
  let lastProposedIdx = -1;
  for (let i = auditLog.length - 1; i >= 0; i--) {
    if (auditLog[i]!.action === "agent.proposed") {
      lastProposedIdx = i;
      break;
    }
  }
  let lastFeedback: string | undefined;
  for (let i = auditLog.length - 1; i > lastProposedIdx; i--) {
    const e = auditLog[i]!;
    if (e.action === "gate.iterate" && e.reason) {
      lastFeedback = e.reason;
      break;
    }
  }

  await appendAudit(rootDir, {
    actor: opts.actor ?? "orchestrator",
    action: "stage.start",
    spec_id: specId,
    reason: lastFeedback
      ? `etapa definicion (con feedback: "${lastFeedback.slice(0, 80)}")`
      : "etapa definicion",
  });

  const { proposed: raw } = await opts.runner.run(current, findings, lastFeedback);
  const verification = verifyProposal(raw);
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

// Verbo de auditoría por estado de revisión (W2): el ciclo queda trazado en el log.
const REVIEW_VERB: Record<ReviewStatus, string> = {
  aprobado: "finding.approve",
  rechazado: "finding.reject",
  en_pausa: "finding.pause",
  pendiente: "finding.resume",
};

/**
 * Revisión humana por hallazgo (W2): setea `review_status` + comentario/quién/cuándo EN SU LUGAR
 * (no borra; el hallazgo queda visible y recuperable). `rechazado` y `en_pausa` exigen comentario
 * (extiende invariante 7). Espeja el cambio en la propuesta si existe. Audita el verbo del estado.
 */
export async function reviewFinding(
  rootDir: string,
  specId: string,
  findingId: string,
  opts: { status: ReviewStatus; comment?: string; actor: string },
): Promise<Finding> {
  const status = opts.status;
  const comment = opts.comment?.trim() || null;
  if ((status === "rechazado" || status === "en_pausa") && !comment) {
    throw new Error(`'${status}' exige un comentario (invariante 7)`);
  }

  const apply = (f: Finding): Finding => ({
    ...f,
    review_status: status,
    review_note: comment,
    reviewed_by: opts.actor,
    reviewed_at: now(),
  });

  const findings = await readFindings(rootDir, specId);
  const idx = findings.findIndex((f) => f.id === findingId);
  if (idx < 0) throw new Error(`hallazgo no encontrado: ${findingId}`);
  const updated = [...findings];
  updated[idx] = apply(findings[idx]!);
  await writeFindings(rootDir, specId, updated);

  // espejar en la propuesta de Definición si existe (mismo estado por ítem) y RECOMPUTAR
  // su verificación: así el gate (que lee proposed.verification) bloquea/desbloquea en vivo
  // según los estados de revisión (W2.3).
  try {
    const proposed = await readProposedSpec(rootDir, specId);
    const pidx = proposed.findings.findIndex((f) => f.id === findingId);
    if (pidx >= 0) {
      const pf = [...proposed.findings];
      pf[pidx] = apply(proposed.findings[pidx]!);
      const next: Spec = { ...proposed, findings: pf };
      next.verification = verifyProposal(next);
      await writeProposedSpec(rootDir, next);
    }
  } catch {
    // no hay propuesta todavía (triage de descubrimiento): ok
  }

  await appendAudit(rootDir, {
    actor: opts.actor,
    action: REVIEW_VERB[status],
    spec_id: specId,
    target: findingId,
    reason: comment,
  });
  return updated[idx]!;
}

/**
 * Rechazo (compat): ahora NO destruye — enruta por `reviewFinding(status=rechazado)`, así el
 * hallazgo queda marcado, auditado y recuperable. Devuelve el set actualizado de hallazgos.
 */
export async function rejectFinding(
  rootDir: string,
  specId: string,
  findingId: string,
  opts: { reason: string; actor: string },
): Promise<Finding[]> {
  await reviewFinding(rootDir, specId, findingId, {
    status: "rechazado",
    comment: opts.reason,
    actor: opts.actor,
  });
  return readFindings(rootDir, specId);
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
  const verification = verifyProposal(proposed);

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
  // la propuesta y los findings de trabajo quedan consumidos (los findings viven en la spec)
  await rm(specPaths(rootDir, specId).proposed, { force: true });
  await rm(specPaths(rootDir, specId).findings, { force: true });

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

/**
 * Etapa 3 — EXPLORACIÓN (Agente 3): precondición spec `approved` con al menos 1 JTBD.
 * Genera conceptos de solución divergentes anclados a los jobs, los persiste en
 * `concepts.yaml` (archivo de trabajo; no es spec.proposed). Audita y commitea.
 */
export async function runExploration(
  rootDir: string,
  specId: string,
  opts: { runner: ExplorationRunner; actor?: string; author?: GitAuthor },
): Promise<ExplorationResult> {
  const current = await readSpec(rootDir, specId);

  if (current.status !== "approved") {
    throw new Error(
      `la spec '${specId}' debe estar en estado 'approved' para explorar (estado actual: ${current.status})`,
    );
  }
  if (current.jtbd.length === 0) {
    throw new Error(
      `la spec '${specId}' no tiene JTBD; ejecuta Definición y apruébala antes de explorar`,
    );
  }

  // Feedback de conceptos descartados: notas de los conceptos con status `descartado`.
  const existing = await readConcepts(rootDir, specId).catch(() => [] as Concept[]);
  const discardedNotes = existing
    .filter((c) => c.review_status === "descartado" && c.review_note)
    .map((c) => `[${c.id}] ${c.title}: ${c.review_note}`)
    .join("\n");

  await appendAudit(rootDir, {
    actor: opts.actor ?? "orchestrator",
    action: "stage.start",
    spec_id: specId,
    reason: discardedNotes
      ? `etapa exploracion (con ${existing.filter((c) => c.review_status === "descartado").length} conceptos descartados previos)`
      : "etapa exploracion",
  });

  const { concepts } = await opts.runner.run(
    current,
    discardedNotes || undefined,
  );
  await writeConcepts(rootDir, specId, concepts);

  await appendAudit(rootDir, {
    actor: "agent3",
    action: "agent.proposed",
    spec_id: specId,
    reason: `${concepts.length} conceptos propuestos (exploracion)`,
  });

  await commitSpec(
    rootDir,
    specId,
    `Agente 3 (Exploración) propone ${concepts.length} conceptos para '${specId}'`,
    opts.author,
  );

  return { specId, stage: "exploracion", concepts };
}

/**
 * Triage de conceptos (humano): seleccionar / descartar / reabrir.
 * `descartado` exige review_note (invariante 7). Escribe en `concepts.yaml`.
 */
export async function reviewConcept(
  rootDir: string,
  specId: string,
  conceptId: string,
  opts: {
    status: "seleccionado" | "descartado" | "propuesto";
    note?: string;
    actor: string;
  },
): Promise<Concept> {
  const { status, note } = opts;
  const trimmedNote = note?.trim() || null;

  if (status === "descartado" && !trimmedNote) {
    throw new Error("'descartado' exige una nota (invariante 7)");
  }

  const concepts = await readConcepts(rootDir, specId);
  const idx = concepts.findIndex((c) => c.id === conceptId);
  if (idx < 0) throw new Error(`concepto no encontrado: ${conceptId}`);

  const updated: Concept = {
    ...concepts[idx]!,
    review_status: status,
    review_note: trimmedNote,
    reviewed_by: opts.actor,
    reviewed_at: now(),
  };
  const next = [...concepts];
  next[idx] = updated;
  await writeConcepts(rootDir, specId, next);

  const verb =
    status === "seleccionado"
      ? "concept.select"
      : status === "descartado"
        ? "concept.discard"
        : "concept.reopen";

  await appendAudit(rootDir, {
    actor: opts.actor,
    action: verb,
    spec_id: specId,
    target: conceptId,
    reason: trimmedNote,
  });

  return updated;
}
