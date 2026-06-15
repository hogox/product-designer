// Paso "computar" del Agente 1 (invariante 4): lo cuantitativo se calcula de forma
// DETERMINISTA sobre las filas, nunca lo estima el modelo. Cada métrica produce un
// `computation` y un `locator` listos para anclarse como evidencia (EvidenceSchema).

import type { Evidence } from "@pda/spec";

import type { TabularDocument, TabularValue } from "./ingest.js";

export interface ComputedMetric {
  label: string; // "drop-off OTP"
  value: number; // proporción (0..1) o magnitud (segundos, conteo)
  display: string; // "43.2%" / "57.3 s" / "315"
  n: number; // tamaño de muestra (denominador)
  computation: string; // texto para evidence.computation
  source: string; // archivo
  locator: string; // hoja + columnas + condición + n
}

type Row = Record<string, TabularValue>;
type Pred = (row: Row) => boolean;

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

// ---------- primitivos deterministas ----------

export function count(rows: Row[], pred: Pred): number {
  let c = 0;
  for (const r of rows) if (pred(r)) c++;
  return c;
}

export function mean(rows: Row[], col: string): number {
  const nums = rows
    .map((r) => Number(r[col]))
    .filter((v) => Number.isFinite(v));
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function distinct(rows: Row[], col: string): string[] {
  const seen = new Set<string>();
  for (const r of rows) {
    const v = r[col];
    if (v !== null && v !== undefined) seen.add(String(v));
  }
  return [...seen].sort();
}

/**
 * Tasa = |evento ∩ universo| / |universo|. El numerador se evalúa SOLO dentro del
 * universo (el numerador es siempre subconjunto del denominador).
 */
export function metricRate(
  doc: TabularDocument,
  args: {
    label: string;
    universe: Pred; // denominador
    event: Pred; // numerador (dentro del universo)
    columns: string[]; // columnas involucradas (locator)
    conditionText: string; // descripción legible
  },
): ComputedMetric {
  const universeRows = doc.rows.filter(args.universe);
  const eventCount = count(universeRows, args.event);
  const n = universeRows.length;
  const value = n === 0 ? 0 : eventCount / n;
  return {
    label: args.label,
    value,
    display: pct(value),
    n,
    computation: `${args.label} = ${pct(value)} (${eventCount}/${n}, n=${n})`,
    source: doc.source,
    locator: `hoja '${doc.sheet}', columnas ${args.columns.join("+")} — ${args.conditionText} (n=${n})`,
  };
}

// ---------- cómputo genérico por convención de columnas (S18 · P0) ----------
// Detecta QUÉ computar por convención determinista (sin modelo, invariante 4):
//   - pares `llego_a_X` / `completo_X`  → drop-off de X (global y por `segmento`)
//   - columnas `error_*` (binarias)     → tasa dentro del universo del funnel
//   - columnas `tiempo_*` (numéricas)   → media en los abandonos
//   - columna `nps` (0–10)              → score NPS (%promotores − %detractores)
//   - columnas `ces` (1–7) / `csat`     → media
//   - columna `categoria`               → participación de la categoría dominante
// Métricas con n=0 se descartan (un CSV sin estas convenciones no produce ruido).

const FUNNEL_PREFIX = "llego_a_";

export function computeTabularMetrics(doc: TabularDocument): ComputedMetric[] {
  const metrics: ComputedMetric[] = [];
  const push = (m: ComputedMetric) => {
    if (m.n > 0) metrics.push(m);
  };

  // --- funnels: pares llego_a_X / completo_X ---
  for (const col of doc.columns) {
    if (!col.startsWith(FUNNEL_PREFIX)) continue;
    const step = col.slice(FUNNEL_PREFIX.length);
    const completedCol = `completo_${step}`;
    if (!doc.columns.includes(completedCol)) continue;

    const reached: Pred = (r) => Number(r[col]) === 1;
    const abandoned: Pred = (r) => Number(r[completedCol]) === 0;

    push(
      metricRate(doc, {
        label: `drop-off ${step}`,
        universe: reached,
        event: abandoned,
        columns: [col, completedCol],
        conditionText: `abandonan (${completedCol}=0) entre los que llegan al paso (${col}=1)`,
      }),
    );

    if (doc.columns.includes("segmento")) {
      for (const seg of distinct(doc.rows, "segmento")) {
        push(
          metricRate(doc, {
            label: `drop-off ${step} · segmento=${seg}`,
            universe: (r) => reached(r) && String(r["segmento"]) === seg,
            event: abandoned,
            columns: ["segmento", col, completedCol],
            conditionText: `abandonan entre los que llegan al paso con segmento=${seg}`,
          }),
        );
      }
    }

    for (const errCol of doc.columns.filter((c) => c.startsWith("error_"))) {
      push(
        metricRate(doc, {
          label: `tasa de ${errCol}`,
          universe: reached,
          event: (r) => Number(r[errCol]) === 1,
          columns: [col, errCol],
          conditionText: `${errCol}=1 entre los que llegan al paso (${col}=1)`,
        }),
      );
    }

    for (const tCol of doc.columns.filter((c) => c.startsWith("tiempo_"))) {
      const abandonRows = doc.rows.filter((r) => reached(r) && abandoned(r));
      if (abandonRows.length === 0) continue;
      const avg = mean(abandonRows, tCol);
      push({
        label: `${tCol} promedio (abandonos)`,
        value: avg,
        display: `${avg.toFixed(1)} s`,
        n: abandonRows.length,
        computation: `${tCol} promedio en abandonos = ${avg.toFixed(1)} s (n=${abandonRows.length})`,
        source: doc.source,
        locator: `hoja '${doc.sheet}', columna ${tCol} — filas con abandono (n=${abandonRows.length})`,
      });
    }
  }

  // --- encuestas: NPS / CES / CSAT ---
  if (doc.columns.includes("nps")) {
    const scores = doc.rows
      .map((r) => Number(r["nps"]))
      .filter((v) => Number.isFinite(v) && v >= 0 && v <= 10);
    if (scores.length > 0) {
      const promoters = scores.filter((v) => v >= 9).length;
      const detractors = scores.filter((v) => v <= 6).length;
      const n = scores.length;
      const pP = promoters / n;
      const pD = detractors / n;
      const score = (pP - pD) * 100;
      push({
        label: "NPS",
        value: score,
        display: score.toFixed(0),
        n,
        computation: `NPS = %promotores − %detractores = ${pct(pP)} − ${pct(pD)} = ${score.toFixed(0)} (n=${n})`,
        source: doc.source,
        locator: `hoja '${doc.sheet}', columna nps — promotores ≥9, detractores ≤6 (n=${n})`,
      });
    }
  }

  for (const surveyCol of ["ces", "csat"] as const) {
    if (!doc.columns.includes(surveyCol)) continue;
    const vals = doc.rows
      .map((r) => Number(r[surveyCol]))
      .filter((v) => Number.isFinite(v));
    if (vals.length === 0) continue;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    push({
      label: `${surveyCol.toUpperCase()} promedio`,
      value: avg,
      display: avg.toFixed(1),
      n: vals.length,
      computation: `${surveyCol.toUpperCase()} promedio = ${avg.toFixed(1)} (n=${vals.length})`,
      source: doc.source,
      locator: `hoja '${doc.sheet}', columna ${surveyCol} (n=${vals.length})`,
    });
  }

  // --- categoría dominante (tickets/soporte) ---
  if (doc.columns.includes("categoria") && doc.rows.length > 0) {
    const counts = new Map<string, number>();
    for (const r of doc.rows) {
      const v = r["categoria"];
      if (v === null || v === undefined) continue;
      const k = String(v);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    if (sorted.length > 0) {
      const [top, c] = sorted[0]!;
      const n = doc.rows.length;
      push({
        label: `categoría dominante: ${top}`,
        value: c / n,
        display: pct(c / n),
        n,
        computation: `categoría '${top}' = ${pct(c / n)} de los registros (${c}/${n}, n=${n})`,
        source: doc.source,
        locator: `hoja '${doc.sheet}', columna categoria — moda (n=${n})`,
      });
    }
  }

  return metrics;
}

// ---------- métricas del funnel OTP (selección por CÓDIGO, no por el modelo) ----------

const reached: Pred = (r) => Number(r["llego_a_otp"]) === 1;
const abandoned: Pred = (r) => Number(r["completo_otp"]) === 0;

export function computeFunnelMetrics(doc: TabularDocument): ComputedMetric[] {
  const metrics: ComputedMetric[] = [];

  // drop-off global
  metrics.push(
    metricRate(doc, {
      label: "drop-off OTP",
      universe: reached,
      event: abandoned,
      columns: ["llego_a_otp", "completo_otp"],
      conditionText:
        "abandonan (completo_otp=0) entre los que llegan al paso OTP (llego_a_otp=1)",
    }),
  );

  // drop-off por segmento
  for (const seg of distinct(doc.rows, "segmento")) {
    metrics.push(
      metricRate(doc, {
        label: `drop-off OTP · segmento=${seg}`,
        universe: (r) => reached(r) && String(r["segmento"]) === seg,
        event: abandoned,
        columns: ["segmento", "llego_a_otp", "completo_otp"],
        conditionText: `abandonan entre los que llegan al OTP con segmento=${seg}`,
      }),
    );
  }

  // tiempo de espera promedio en los abandonos
  const abandonRows = doc.rows.filter((r) => reached(r) && abandoned(r));
  const avg = mean(abandonRows, "tiempo_espera_seg");
  metrics.push({
    label: "tiempo de espera promedio (abandonos)",
    value: avg,
    display: `${avg.toFixed(1)} s`,
    n: abandonRows.length,
    computation: `tiempo de espera promedio en abandonos = ${avg.toFixed(1)} s (n=${abandonRows.length})`,
    source: doc.source,
    locator: `hoja '${doc.sheet}', columna tiempo_espera_seg — filas con abandono (n=${abandonRows.length})`,
  });

  return metrics;
}

// ---------- puente a evidencia anclada (spec) ----------

/** Convierte una métrica computada en una evidencia tabular (source + locator + computation). */
export function metricToEvidence(m: ComputedMetric): Evidence {
  return { source: m.source, locator: m.locator, computation: m.computation };
}
