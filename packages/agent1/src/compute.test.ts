import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { EvidenceSchema } from "@pda/spec";

import {
  ingestCsv,
  computeFunnelMetrics,
  computeTabularMetrics,
  metricRate,
  metricToEvidence,
  count,
  mean,
  type TabularDocument,
} from "./index.js";

const tabular = (
  columns: string[],
  rows: TabularDocument["rows"],
  source = "test.csv",
): TabularDocument => ({
  kind: "tabular",
  source,
  path: `/tmp/${source}`,
  sheet: "csv",
  columns,
  rows,
});

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

// ---------- computeTabularMetrics (genérico, S18 · P0) ----------

test("computeTabularMetrics: detecta cualquier funnel llego_a_X/completo_X", () => {
  const doc = tabular(
    ["sesion_id", "llego_a_pago", "completo_pago", "segmento"],
    [
      { sesion_id: "s1", llego_a_pago: 1, completo_pago: 0, segmento: "nuevo" },
      { sesion_id: "s2", llego_a_pago: 1, completo_pago: 1, segmento: "nuevo" },
      { sesion_id: "s3", llego_a_pago: 1, completo_pago: 1, segmento: "recurrente" },
      { sesion_id: "s4", llego_a_pago: 0, completo_pago: 0, segmento: "recurrente" },
    ],
    "funnel-checkout.csv",
  );
  const metrics = computeTabularMetrics(doc);
  const dropOff = metrics.find((m) => m.label === "drop-off pago");
  assert.ok(dropOff);
  assert.equal(dropOff!.n, 3); // 3 llegan al paso
  assert.equal(dropOff!.display, "33.3%"); // 1 de 3 abandona
  // por segmento también
  assert.ok(metrics.some((m) => m.label === "drop-off pago · segmento=nuevo"));
});

test("computeTabularMetrics: columnas error_* y tiempo_* dentro del funnel", () => {
  const doc = tabular(
    ["llego_a_pago", "completo_pago", "error_pago", "tiempo_checkout_seg"],
    [
      { llego_a_pago: 1, completo_pago: 0, error_pago: 1, tiempo_checkout_seg: 200 },
      { llego_a_pago: 1, completo_pago: 0, error_pago: 0, tiempo_checkout_seg: 100 },
      { llego_a_pago: 1, completo_pago: 1, error_pago: 0, tiempo_checkout_seg: 60 },
      { llego_a_pago: 1, completo_pago: 1, error_pago: 1, tiempo_checkout_seg: 80 },
    ],
  );
  const metrics = computeTabularMetrics(doc);
  const errRate = metrics.find((m) => m.label === "tasa de error_pago");
  assert.ok(errRate);
  assert.equal(errRate!.display, "50.0%"); // 2 de 4 en el universo
  const tiempo = metrics.find((m) => m.label.startsWith("tiempo_checkout_seg"));
  assert.ok(tiempo);
  assert.equal(tiempo!.display, "150.0 s"); // media de los 2 abandonos (200+100)/2
  assert.equal(tiempo!.n, 2);
});

test("computeTabularMetrics: NPS = %promotores − %detractores", () => {
  // 2 promotores (9,10), 1 pasivo (8), 2 detractores (3,6) → 40% − 40% = 0
  const doc = tabular(
    ["respondente", "nps"],
    [
      { respondente: "r1", nps: 9 },
      { respondente: "r2", nps: 10 },
      { respondente: "r3", nps: 8 },
      { respondente: "r4", nps: 3 },
      { respondente: "r5", nps: 6 },
    ],
    "nps.csv",
  );
  const metrics = computeTabularMetrics(doc);
  const nps = metrics.find((m) => m.label === "NPS");
  assert.ok(nps);
  assert.equal(nps!.value, 0);
  assert.equal(nps!.n, 5);
  assert.match(nps!.computation, /40\.0% − 40\.0%/);
});

test("computeTabularMetrics: CES promedio + categoría dominante", () => {
  const cesDoc = tabular(
    ["ces"],
    [{ ces: 5 }, { ces: 4 }, { ces: 6 }],
    "ces.csv",
  );
  const ces = computeTabularMetrics(cesDoc).find((m) => m.label === "CES promedio");
  assert.ok(ces);
  assert.equal(ces!.display, "5.0");

  const tickets = tabular(
    ["ticket_id", "categoria"],
    [
      { ticket_id: "T1", categoria: "error_pago" },
      { ticket_id: "T2", categoria: "error_pago" },
      { ticket_id: "T3", categoria: "demora" },
      { ticket_id: "T4", categoria: "otro" },
    ],
    "tickets.csv",
  );
  const top = computeTabularMetrics(tickets).find((m) =>
    m.label.startsWith("categoría dominante"),
  );
  assert.ok(top);
  assert.equal(top!.display, "50.0%"); // error_pago 2/4
  assert.match(top!.computation, /error_pago/);
});

test("computeTabularMetrics: sin convenciones → sin métricas (cero ruido, n=0 guard)", () => {
  const doc = tabular(
    ["id", "descripcion"],
    [{ id: "1", descripcion: "texto libre" }],
  );
  assert.deepEqual(computeTabularMetrics(doc), []);
});

test("computeTabularMetrics: sobre el funnel OTP real da el mismo drop-off que la OTP-específica", async () => {
  const doc = await ingestCsv(FUNNEL);
  const generic = computeTabularMetrics(doc).find((m) => m.label === "drop-off otp");
  const otp = computeFunnelMetrics(doc).find((m) => m.label === "drop-off OTP");
  assert.ok(generic && otp);
  assert.equal(generic!.value, otp!.value);
  assert.equal(generic!.n, otp!.n);
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
