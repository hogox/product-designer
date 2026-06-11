// Intake de spec (Fase D2 · W6): persistencia del enmarcado del discovery + completitud de
// fuentes. La validación vive en IntakeSchema (schema.ts); acá está el store (escribir el
// intake, auditar) y el cómputo determinista de esperado-vs-subido para el hub de Fuentes.

import { appendAudit } from "./audit.js";
import {
  IntakeSchema,
  deriveExpectedSourceKinds,
  type Intake,
  type Spec,
  type SourceKind,
} from "./schema.js";
import { readSources } from "./sources.js";
import { readSpec, writeSpec } from "./store.js";

/**
 * Setea/reemplaza el `intake` de la spec (validado) y audita `intake.update`. Si el plan trae
 * métodos pero `expectedSourceKinds` vacío, lo deriva del mapa determinista (sigue siendo
 * editable: si el cliente manda tipos explícitos, se respetan). Base del retrofit (W6.4).
 */
export async function updateIntake(
  rootDir: string,
  specId: string,
  input: unknown,
  actor: string,
): Promise<Spec> {
  const parsed = IntakeSchema.parse(input); // researchQuestion obligatoria; throw → 400 en API
  const plan = parsed.discoveryPlan;
  const expectedSourceKinds =
    plan.expectedSourceKinds.length === 0 && plan.methods.length > 0
      ? deriveExpectedSourceKinds(plan.methods)
      : plan.expectedSourceKinds;
  const intake: Intake = {
    ...parsed,
    discoveryPlan: { ...plan, expectedSourceKinds },
  };

  const spec = await readSpec(rootDir, specId); // 404 si no existe
  const next: Spec = { ...spec, intake };
  await writeSpec(rootDir, next); // valida antes de escribir
  await appendAudit(rootDir, {
    actor,
    action: "intake.update",
    spec_id: specId,
    reason: intake.researchQuestion.slice(0, 120),
  });
  return next;
}

export interface SourceCompleteness {
  /** tipos esperados según el plan de discovery (intake) */
  expected: SourceKind[];
  /** tipos presentes entre las fuentes NO descartadas */
  present: SourceKind[];
  /** esperados que aún no se subieron (chips "falta: …") */
  missing: SourceKind[];
  /** true si no falta ningún tipo esperado (o no hay plan que exija tipos) */
  satisfied: boolean;
}

/**
 * Completitud de fuentes (W6.2b): compara los tipos esperados del plan de discovery contra
 * los tipos efectivamente subidos (no descartados). Sin intake / sin tipos esperados →
 * satisfied=true (no hay nada exigido). Determinista, sin modelo.
 */
export async function computeSourceCompleteness(
  rootDir: string,
  specId: string,
): Promise<SourceCompleteness> {
  const spec = await readSpec(rootDir, specId);
  const expected = spec.intake?.discoveryPlan.expectedSourceKinds ?? [];
  const sources = await readSources(rootDir, specId);
  const present = [
    ...new Set(
      sources.filter((s) => s.status !== "descartado").map((s) => s.kind),
    ),
  ];
  const missing = expected.filter((k) => !present.includes(k));
  return { expected, present, missing, satisfied: missing.length === 0 };
}
