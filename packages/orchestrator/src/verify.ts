// Criterios de verificación AUTOMATIZADOS (deterministas) sobre los hallazgos de una
// propuesta. Materializan los invariantes anti-alucinación; el gate exige que los
// bloqueantes pasen antes de aprobar.

import type {
  Concept,
  Finding,
  Job,
  Spec,
  VerificationCriterion,
} from "@pda/spec";

function crit(
  criterion: string,
  pass: boolean,
  evidence: string,
): VerificationCriterion {
  return {
    criterion,
    type: "automated",
    blocking: true,
    status: pass ? "pass" : "fail",
    evidence,
  };
}

/** Verifica que toda afirmación esté anclada (invariantes 3, 4, 5). */
export function automatedVerification(
  findings: Finding[],
): VerificationCriterion[] {
  const anchored = findings.filter((f) => f.evidence.length > 0).length;
  const quant = findings.filter((f) => f.type === "quantitative");
  const quantOk = quant.filter((f) =>
    f.evidence.some((e) => e.computation !== undefined),
  ).length;
  const qual = findings.filter((f) => f.type === "qualitative");
  const qualOk = qual.filter((f) =>
    f.evidence.some((e) => e.quote !== undefined),
  ).length;

  return [
    crit(
      "Todo hallazgo tiene evidencia anclada (archivo + locator + cita/cálculo)",
      anchored === findings.length,
      `${anchored}/${findings.length} hallazgos anclados`,
    ),
    crit(
      "Lo cuantitativo está computado, no estimado",
      quantOk === quant.length,
      `${quantOk}/${quant.length} hallazgos cuantitativos con cálculo`,
    ),
    crit(
      "Lo cualitativo tiene cita textual",
      qualOk === qual.length,
      `${qualOk}/${qual.length} hallazgos cualitativos con cita`,
    ),
  ];
}

/**
 * Verificación específica de DEFINICIÓN (cierre del diamante Problema): el enmarcado está
 * completo y con procedencia — hay problem statement, todo JTBD se ancla a hallazgos reales,
 * y toda métrica declara su categoría HEART.
 */
export function definitionVerification(
  proposed: Spec,
): VerificationCriterion[] {
  const findingIds = new Set(proposed.findings.map((f) => f.id));
  const hasProblem = (proposed.problem_statement ?? "").trim().length > 0;
  const jobsAnchored = proposed.jtbd.every(
    (j) =>
      j.supported_by.length > 0 &&
      j.supported_by.every((id) => findingIds.has(id)),
  );
  const metricsHeart = proposed.outcomes.every((o) => o.heart != null);

  return [
    crit(
      "Hay un problem statement de Definición",
      hasProblem,
      hasProblem ? "presente" : "ausente",
    ),
    crit(
      "Todo JTBD está anclado a hallazgos reales (procedencia)",
      jobsAnchored,
      `${proposed.jtbd.length} jobs`,
    ),
    crit(
      "Toda métrica declara categoría HEART",
      metricsHeart,
      `${proposed.outcomes.length} métricas`,
    ),
  ];
}

/**
 * Verificación por ESTADO DE REVISIÓN (D2 · W2.3): la compuerta no puede aprobarse con
 * hallazgos de impacto alto (`confidence: high`) sin resolver — `pendiente` o `en_pausa`
 * bloquean. Los `medium/low` en pausa generan una advertencia NO bloqueante (umbral
 * confirmado: high bloquea, medium/low advierte).
 */
export function reviewVerification(
  findings: Finding[],
): VerificationCriterion[] {
  const highUnresolved = findings.filter(
    (f) =>
      f.confidence === "high" &&
      (f.review_status === "pendiente" || f.review_status === "en_pausa"),
  );
  const lowMedPaused = findings.filter(
    (f) => f.confidence !== "high" && f.review_status === "en_pausa",
  );

  const out: VerificationCriterion[] = [
    crit(
      "Sin hallazgos de impacto alto pendientes ni en pausa",
      highUnresolved.length === 0,
      highUnresolved.length === 0
        ? "todos los high resueltos (aprobado/rechazado)"
        : `${highUnresolved.length} high sin resolver: ${highUnresolved.map((f) => f.id).join(", ")}`,
    ),
  ];
  if (lowMedPaused.length > 0) {
    out.push({
      criterion: "Hallazgos de impacto medio/bajo en pausa (advertencia)",
      type: "automated",
      blocking: false, // advierte, no bloquea
      status: "fail",
      evidence: `${lowMedPaused.length} en pausa: ${lowMedPaused.map((f) => f.id).join(", ")}`,
    });
  }
  return out;
}

/**
 * Verificación de cierre de EXPLORACIÓN (P4): el triage está completo y con procedencia —
 * hay al menos un concepto seleccionado, no queda ninguno `propuesto` sin resolver, y todo
 * seleccionado cita JTBD que existen en la spec vigente. Es la precondición del Agente 4.
 */
export function explorationVerification(
  concepts: Concept[],
  jobs: Job[],
): VerificationCriterion[] {
  const jobIds = new Set(jobs.map((j) => j.id));
  const selected = concepts.filter((c) => c.review_status === "seleccionado");
  const stillProposed = concepts.filter(
    (c) => c.review_status === "propuesto",
  );
  const selectedAnchored = selected.every(
    (c) =>
      c.addresses_jtbd.length > 0 &&
      c.addresses_jtbd.every((id) => jobIds.has(id)),
  );

  return [
    crit(
      "Hay al menos un concepto seleccionado",
      selected.length > 0,
      `${selected.length} seleccionados`,
    ),
    crit(
      "No quedan conceptos propuestos sin resolver (triage completo)",
      stillProposed.length === 0,
      stillProposed.length === 0
        ? "triage completo"
        : `${stillProposed.length} sin resolver: ${stillProposed.map((c) => c.id).join(", ")}`,
    ),
    crit(
      "Todo concepto seleccionado cita JTBD vigentes (procedencia)",
      selectedAnchored,
      `${selected.length} seleccionados anclados`,
    ),
  ];
}

/** Verificación completa de una propuesta de Definición: hallazgos + enmarcado + revisión. */
export function verifyProposal(proposed: Spec): VerificationCriterion[] {
  return [
    ...automatedVerification(proposed.findings),
    ...definitionVerification(proposed),
    ...reviewVerification(proposed.findings),
  ];
}

/** ¿Pasan todos los criterios bloqueantes? */
export function blockingPasses(criteria: VerificationCriterion[]): boolean {
  return criteria.every((c) => !c.blocking || c.status === "pass");
}
