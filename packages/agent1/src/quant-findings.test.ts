import { test } from "node:test";
import assert from "node:assert/strict";

import { FindingSchema } from "@pda/spec";

import {
  buildQuantitativeFindings,
  confidenceFromN,
  type ComputedMetric,
} from "./index.js";

const metric = (over: Partial<ComputedMetric> = {}): ComputedMetric => ({
  label: "drop-off OTP",
  value: 0.432,
  display: "43.2%",
  n: 315,
  computation: "drop-off OTP = 43.2% (136/315, n=315)",
  source: "funnel-otp.csv",
  locator: "hoja 'csv', columnas llego_a_otp+completo_otp (n=315)",
  ...over,
});

test("confidenceFromN: umbrales deterministas", () => {
  assert.equal(confidenceFromN(315), "high");
  assert.equal(confidenceFromN(100), "high");
  assert.equal(confidenceFromN(99), "medium");
  assert.equal(confidenceFromN(30), "medium");
  assert.equal(confidenceFromN(29), "low");
  assert.equal(confidenceFromN(0), "low");
});

test("buildQuantitativeFindings: hallazgo válido desde la métrica, sin modelo", () => {
  const findings = buildQuantitativeFindings([metric()]);
  assert.equal(findings.length, 1);
  const f = findings[0]!;
  assert.equal(f.id, "F-001");
  assert.equal(f.type, "quantitative");
  assert.equal(f.statement, "drop-off OTP: 43.2% (n=315)");
  assert.equal(f.confidence, "high");
  assert.equal(f.feeds, "outcomes");
  // la evidencia es el cálculo mismo (invariante 5: fuente anclada)
  assert.equal(f.evidence[0]!.computation, metric().computation);
  assert.equal(f.evidence[0]!.source, "funnel-otp.csv");
  assert.equal(FindingSchema.safeParse(f).success, true);
});

test("buildQuantitativeFindings: ids secuenciales y firstId", () => {
  const findings = buildQuantitativeFindings(
    [metric(), metric({ label: "espera media", display: "57.3 s", n: 12 })],
    { firstId: 5 },
  );
  assert.equal(findings[0]!.id, "F-005");
  assert.equal(findings[1]!.id, "F-006");
  // n chico → low (no estima: deriva del n computado)
  assert.equal(findings[1]!.confidence, "low");
});

test("buildQuantitativeFindings: lista vacía → sin hallazgos", () => {
  assert.deepEqual(buildQuantitativeFindings([]), []);
});
