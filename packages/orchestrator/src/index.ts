// @pda/orchestrator — orquestador mínimo (v0).
// Enruta, no diseña: routing de dos etapas (Descubrimiento → Definición), verificación,
// gate (bloquea hasta aprobación humana) y auditoría. NUNCA sube versión sin aprobación.

export const PACKAGE_NAME = "@pda/orchestrator";

export * from "./verify.js";
export * from "./stage.js";
export * from "./runner.js";
export * from "./result-cache.js";
