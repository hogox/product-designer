// Hallazgos cuantitativos por SCRIPT (Sesión 17 — O2 · P1, invariante 4 llevada al final):
// las métricas ya se computan determinísticamente (compute.ts); re-mandarlas al modelo para
// que las re-redacte como hallazgos era pagar tokens por parafrasear un número, con riesgo
// de distorsión. Este módulo emite el hallazgo quantitative directo desde ComputedMetric.
// El modelo queda solo para lo cualitativo (citas), que sí requiere síntesis.

import { FindingSchema, type Confidence, type Finding } from "@pda/spec";

import { metricToEvidence, type ComputedMetric } from "./compute.js";

/**
 * Confianza derivada del tamaño de muestra (convención determinista, no estimación):
 * n ≥ 100 → high, n ≥ 30 → medium, menos → low.
 */
export function confidenceFromN(n: number): Confidence {
  if (n >= 100) return "high";
  if (n >= 30) return "medium";
  return "low";
}

/**
 * Construye hallazgos quantitative desde métricas computadas, sin modelo (0 tokens).
 * statement = template sobre los valores ya calculados; evidencia = el cálculo mismo.
 * Los ids arrancan en firstId (default 1); los del modelo continúan la numeración.
 */
export function buildQuantitativeFindings(
  metrics: ComputedMetric[],
  opts: { firstId?: number } = {},
): Finding[] {
  let counter = (opts.firstId ?? 1) - 1;
  return metrics.map((m) => {
    counter++;
    return FindingSchema.parse({
      id: `F-${String(counter).padStart(3, "0")}`,
      statement: `${m.label}: ${m.display} (n=${m.n})`,
      type: "quantitative",
      evidence: [metricToEvidence(m)],
      confidence: confidenceFromN(m.n),
      status: "proposed",
      feeds: "outcomes",
      reviewed_by: null,
      review_note: null,
    });
  });
}
