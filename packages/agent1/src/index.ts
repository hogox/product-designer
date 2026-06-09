// @pda/agent1 — Agente 1 (Descubrimiento).
// Loop: recolectar → extraer evidencia → computar (determinista) → derivar hallazgos.
// La síntesis/Definición vive en @pda/agent2 (Fase 2).

export const PACKAGE_NAME = "@pda/agent1";

export * from "./ingest.js";
export * from "./compute.js";
export * from "./extract.js";
export * from "./derive.js";
