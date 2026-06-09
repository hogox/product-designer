// Esquema de la spec (PRD §7) — v0 desechable, validado con zod.
// Las reglas del objeto `finding` materializan los invariantes 3 y 5:
// la evidencia ancla a fuente + locator + cita (texto) o cálculo (tabular),
// y un hallazgo sin evidencia es inválido.

import { z } from "zod";

// ---------- enums ----------

export const StageSchema = z.enum([
  "descubrimiento",
  "definicion",
  "exploracion",
  "diseno",
  "validacion",
  "entrega",
  "aprendizaje",
]);
export type Stage = z.infer<typeof StageSchema>;

export const SpecStatusSchema = z.enum([
  "draft",
  "in_review",
  "approved",
  "superseded",
]);
export type SpecStatus = z.infer<typeof SpecStatusSchema>;

export const FindingTypeSchema = z.enum(["qualitative", "quantitative"]);
export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export const FindingStatusSchema = z.enum([
  "proposed",
  "validated",
  "rejected",
]);
export const FindingFeedsSchema = z.enum([
  "outcomes",
  "constraints",
  "hypothesis",
  "scope",
]);
export type FindingType = z.infer<typeof FindingTypeSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type FindingStatus = z.infer<typeof FindingStatusSchema>;
export type FindingFeeds = z.infer<typeof FindingFeedsSchema>;

// Categorías HEART (métricas de Definición).
export const HeartCategorySchema = z.enum([
  "happiness",
  "engagement",
  "adoption",
  "retention",
  "task_success",
]);
export type HeartCategory = z.infer<typeof HeartCategorySchema>;

export const TaskOwnerSchema = z.enum(["agent", "human"]);
export const TaskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "done",
  "blocked",
]);

export const VerificationTypeSchema = z.enum(["automated", "human"]);
export const VerificationStatusSchema = z.enum(["pending", "pass", "fail"]);

// ---------- primitivos ----------

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "fecha debe ser ISO YYYY-MM-DD");

const isoDateTime = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "datetime ISO inválido");

// ---------- evidencia + hallazgo (objeto de primera clase, §7) ----------

// Invariante 5: toda evidencia ancla a source + locator + (quote | computation).
export const EvidenceSchema = z
  .object({
    source: z.string().min(1), // archivo de origen, p. ej. "entrevista_07.pdf"
    locator: z.string().min(1), // p. ej. "p.3, párrafo 2" o "hoja 'funnel', filas 40-128"
    quote: z.string().min(1).optional(), // cita textual (cualitativo)
    computation: z.string().min(1).optional(), // dato COMPUTADO, no estimado (tabular)
  })
  .refine((e) => e.quote !== undefined || e.computation !== undefined, {
    message: "evidence requiere quote (texto) o computation (cálculo)",
  });
export type Evidence = z.infer<typeof EvidenceSchema>;

export const FindingSchema = z
  .object({
    id: z.string().min(1),
    statement: z.string().min(1),
    type: FindingTypeSchema,
    evidence: z
      .array(EvidenceSchema)
      .min(1, "un hallazgo sin evidencia es inválido"),
    confidence: ConfidenceSchema,
    status: FindingStatusSchema,
    feeds: FindingFeedsSchema,
    reviewed_by: z.string().min(1).nullable().default(null),
    review_note: z.string().min(1).nullable().default(null),
  })
  .superRefine((f, ctx) => {
    // Invariante 4/5: lo cuantitativo se computa, no se estima.
    if (
      f.type === "quantitative" &&
      !f.evidence.some((e) => e.computation !== undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidence"],
        message:
          "un hallazgo quantitative exige al menos una evidence con computation",
      });
    }
    if (
      f.type === "qualitative" &&
      !f.evidence.some((e) => e.quote !== undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidence"],
        message:
          "un hallazgo qualitative exige al menos una evidence con quote textual",
      });
    }
  });
export type Finding = z.infer<typeof FindingSchema>;

// ---------- los 6 elementos de la spec (§7) ----------

// 1. Outcomes — qué éxito y cómo se mide.
// heart/signals los enriquece el Agente de Definición (Fase 2); opcionales para
// compatibilidad con specs previas (pasada ligera de Fase 1).
export const OutcomeSchema = z.object({
  metric: z.string().min(1),
  baseline: z.string().nullable(),
  target: z.string().min(1),
  method: z.string().min(1),
  heart: HeartCategorySchema.nullable().optional(),
  signals: z.array(z.string()).optional(),
});

// 2. Alcance — qué entra y qué NO
export const ScopeSchema = z.object({
  in_scope: z.array(z.string()),
  non_goals: z.array(z.string()),
});

// 3. Restricciones
export const DesignSystemRefSchema = z.object({
  name: z.string(),
  version: z.string(),
  link: z.string(),
});
export const ConstraintsSchema = z.object({
  regulatory: z.array(z.string()),
  accessibility: z.string(),
  design_system: DesignSystemRefSchema,
  technical: z.array(z.string()),
});

// 4. Decisiones previas (con rationale)
export const DecisionSchema = z.object({
  id: z.string().min(1),
  date: isoDate,
  decision: z.string().min(1),
  rationale: z.string().min(1),
  author: z.string().min(1), // humano o agente
  supersedes: z.string().nullable(),
});

// 5. Desglose de tareas
export const TaskSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  stage: z.string().min(1),
  owner: TaskOwnerSchema,
  status: TaskStatusSchema,
});

// 6. Criterios de verificación
export const VerificationCriterionSchema = z.object({
  criterion: z.string().min(1),
  type: VerificationTypeSchema,
  blocking: z.boolean(),
  status: VerificationStatusSchema,
  evidence: z.string().nullable(),
});

// Jobs To Be Done (output de Definición). Cada job se ancla a los hallazgos que lo motivan
// (procedencia heredada §D19): supported_by referencia ids de findings.
export const JobSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1), // "Cuando [situación], quiero [motivación], para [resultado]"
  supported_by: z.array(z.string()).min(1), // ids de findings que lo sustentan
});
export type Job = z.infer<typeof JobSchema>;

// Procedencia / auditoría: la versión sube SOLO al aprobar una compuerta.
export const HistoryEntrySchema = z.object({
  version: z.number().int().nonnegative(),
  stage: z.string().min(1),
  proposed_by: z.string().min(1), // agente o humano
  change_summary: z.string().min(1),
  approved_by: z.string().min(1).nullable(), // humano que aprobó la compuerta
  timestamp: isoDateTime,
});

// ---------- la spec ----------

export const SpecSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  version: z.number().int().nonnegative(), // incrementa solo al aprobar una compuerta
  status: SpecStatusSchema,
  current_stage: StageSchema,
  // Borrador de problem statement (pasada ligera de Definición). Opcional en v0.
  problem_statement: z.string().nullable().default(null),
  outcomes: z.array(OutcomeSchema),
  scope: ScopeSchema,
  constraints: ConstraintsSchema,
  decisions: z.array(DecisionSchema),
  tasks: z.array(TaskSchema),
  verification: z.array(VerificationCriterionSchema),
  findings: z.array(FindingSchema),
  jtbd: z.array(JobSchema).default([]), // Jobs To Be Done (Definición)
  history: z.array(HistoryEntrySchema),
});
export type Spec = z.infer<typeof SpecSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type VerificationCriterion = z.infer<typeof VerificationCriterionSchema>;
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

// ---------- helpers ----------

/** Valida `data` como Spec; lanza ZodError si es inválida. */
export function parseSpec(data: unknown): Spec {
  return SpecSchema.parse(data);
}

/** Valida `data` sin lanzar; devuelve el result discriminado de zod. */
export function safeParseSpec(
  data: unknown,
): z.SafeParseReturnType<unknown, Spec> {
  return SpecSchema.safeParse(data);
}

/**
 * Crea una spec v0 mínima y válida (PRD §10: título + etapa de descubrimiento).
 * El esquema v0 es desechable; se revisa tras el Agente 1 (invariante 6).
 */
export function createSpecV0(input: { id: string; title: string }): Spec {
  return {
    id: input.id,
    title: input.title,
    version: 0,
    status: "draft",
    current_stage: "descubrimiento",
    problem_statement: null,
    outcomes: [],
    scope: { in_scope: [], non_goals: [] },
    constraints: {
      regulatory: [],
      accessibility: "",
      design_system: { name: "", version: "", link: "" },
      technical: [],
    },
    decisions: [],
    tasks: [],
    verification: [],
    findings: [],
    jtbd: [],
    history: [],
  };
}
