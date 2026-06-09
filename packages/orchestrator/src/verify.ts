// Criterios de verificación AUTOMATIZADOS (deterministas) sobre los hallazgos de una
// propuesta. Materializan los invariantes anti-alucinación; el gate exige que los
// bloqueantes pasen antes de aprobar.

import type { Finding, VerificationCriterion } from "@pda/spec";

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

/** ¿Pasan todos los criterios bloqueantes? */
export function blockingPasses(criteria: VerificationCriterion[]): boolean {
  return criteria.every((c) => !c.blocking || c.status === "pass");
}
