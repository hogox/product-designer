import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { EvidenceSchema } from "@pda/spec";

import {
  ingestCsv,
  computeFunnelMetrics,
  metricRate,
  metricToEvidence,
  count,
  mean,
  type TabularDocument,
} from "./index.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FUNNEL = join(REPO, "samples", "analitica", "funnel-otp.csv");

test("drop-off OTP computado = recálculo a mano (invariante 4)", async () => {
  const doc = await ingestCsv(FUNNEL);

  // recálculo independiente en el test, directo sobre las filas
  const reached = doc.rows.filter((r) => Number(r.llego_a_otp) === 1);
  const abandoned = reached.filter((r) => Number(r.completo_otp) === 0);
  const expected = abandoned.length / reached.length;
  const expectedDisplay = `${(expected * 100).toFixed(1)}%`;

  const metrics = computeFunnelMetrics(doc);
  const dropOff = metrics.find((m) => m.label === "drop-off OTP");
  assert.ok(dropOff);
  assert.equal(dropOff!.value, expected);
  assert.equal(dropOff!.display, expectedDisplay);
  assert.equal(dropOff!.n, reached.length);
  // con el set sintético actual: 136/315 = 43.2%
  assert.equal(dropOff!.n, 315);
  assert.equal(dropOff!.display, "43.2%");
  // el texto del cálculo lleva el conteo y la n
  assert.match(dropOff!.computation, /136\/315/);
});

test("el cómputo es determinista (misma entrada → misma salida)", async () => {
  const doc = await ingestCsv(FUNNEL);
  const a = computeFunnelMetrics(doc);
  const b = computeFunnelMetrics(doc);
  assert.deepEqual(a, b);
});

test("hay métricas por segmento y todas son proporciones válidas", async () => {
  const doc = await ingestCsv(FUNNEL);
  const metrics = computeFunnelMetrics(doc);
  const porSegmento = metrics.filter((m) => m.label.includes("segmento="));
  assert.ok(porSegmento.length >= 2);
  for (const m of porSegmento) {
    assert.ok(m.value >= 0 && m.value <= 1);
    assert.ok(m.n > 0);
  }
});

test("metricToEvidence produce una evidencia tabular válida (con computation)", async () => {
  const doc = await ingestCsv(FUNNEL);
  const dropOff = computeFunnelMetrics(doc)[0]!;
  const evidence = metricToEvidence(dropOff);
  const res = EvidenceSchema.safeParse(evidence);
  assert.equal(res.success, true);
  assert.ok(evidence.computation && !evidence.quote); // tabular: cálculo, no cita
});

test("primitivos count/mean/metricRate sobre un doc mínimo", () => {
  const doc: TabularDocument = {
    kind: "tabular",
    source: "mini.csv",
    path: "/tmp/mini.csv",
    sheet: "csv",
    columns: ["llego_a_otp", "completo_otp", "tiempo_espera_seg"],
    rows: [
      { llego_a_otp: 1, completo_otp: 0, tiempo_espera_seg: 50 },
      { llego_a_otp: 1, completo_otp: 1, tiempo_espera_seg: 10 },
      { llego_a_otp: 0, completo_otp: 0, tiempo_espera_seg: 0 },
      { llego_a_otp: 1, completo_otp: 0, tiempo_espera_seg: 70 },
    ],
  };
  assert.equal(
    count(doc.rows, (r) => Number(r.llego_a_otp) === 1),
    3,
  );
  assert.equal(mean(doc.rows, "tiempo_espera_seg"), 32.5);

  const m = metricRate(doc, {
    label: "drop-off OTP",
    universe: (r) => Number(r.llego_a_otp) === 1,
    event: (r) => Number(r.completo_otp) === 0,
    columns: ["llego_a_otp", "completo_otp"],
    conditionText: "abandonan entre los que llegan",
  });
  // 2 de 3 abandonan
  assert.equal(m.n, 3);
  assert.equal(m.display, "66.7%");
  assert.match(m.computation, /2\/3/);
});
