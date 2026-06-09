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
