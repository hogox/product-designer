// @pda/agent1 — Agente 1 (Descubrimiento).
// Loop: recolectar → extraer evidencia → computar (determinista) → derivar hallazgos → sintetizar.
// Paso 1.2: ingestión (recolectar). Extracción/cómputo/derivación llegan en 1.3–1.6.

export const PACKAGE_NAME = "@pda/agent1";

export * from "./ingest.js";
export * from "./compute.js";
export * from "./extract.js";
