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
// Estado de revisión humana por hallazgo (Fase D2 · W2): ciclo de vida visible y auditado.
export const ReviewStatusSchema = z.enum([
  "pendiente",
  "aprobado",
  "rechazado",
  "en_pausa",
]);
export type FindingType = z.infer<typeof FindingTypeSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type FindingStatus = z.infer<typeof FindingStatusSchema>;
export type FindingFeeds = z.infer<typeof FindingFeedsSchema>;
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

// Categorías HEART (métricas de Definición).
export const HeartCategorySchema = z.enum([
  "happiness",
  "engagement",
  "adoption",
  "retention",
  "task_success",
]);
export type HeartCategory = z.infer<typeof HeartCategorySchema>;

// Tipo de fuente (vocabulario core, compartido por el hub de Fuentes y el intake). Vive
// acá —no en sources.ts— para que el intake lo reuse sin import circular. `persona` es un
// artefacto de research subible como EVIDENCIA citable (nunca grounding, invariante 3);
// como `entrevista`, no se auto-infiere por mime/extensión (lo clasifica el humano).
export const SourceKindSchema = z.enum([
  "documento",
  "datos",
  "entrevista",
  "persona",
  "otro",
]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

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
    // Revisión humana por ítem (W2): review_status arranca `pendiente` (default → las specs
    // previas cargan sin romper); review_note guarda el comentario, reviewed_by/_at el quién/cuándo.
    review_status: ReviewStatusSchema.default("pendiente"),
    reviewed_by: z.string().min(1).nullable().default(null),
    review_note: z.string().min(1).nullable().default(null),
    reviewed_at: isoDateTime.nullable().default(null),
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

// Estado de revisión de un concepto de solución (Exploración, F3).
// `propuesto` = estado inicial; `seleccionado` = humano elige desarrollarlo;
// `descartado` = humano lo descarta (exige review_note, invariante 7).
export const ConceptReviewStatusSchema = z.enum([
  "propuesto",
  "seleccionado",
  "descartado",
]);
export type ConceptReviewStatus = z.infer<typeof ConceptReviewStatusSchema>;

// Concepto de solución (output de Exploración): una dirección de diseño anclada a los
// jobs que aborda. El assembly del Agente 3 rechaza conceptos que citen J-xxx inexistentes.
export const ConceptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  rationale: z.string().min(1),
  addresses_jtbd: z
    .array(z.string().min(1))
    .min(1, "un concepto debe citar al menos un JTBD"),
  // Procedencia (P1): versión de la spec contra cuyos JTBD nació el concepto. Nullable +
  // default null → los concepts.yaml previos cargan sin migrar; el orquestador lo estampa.
  spec_version: z.number().int().nonnegative().nullable().default(null),
  review_status: ConceptReviewStatusSchema.default("propuesto"),
  review_note: z.string().min(1).nullable().default(null),
  reviewed_by: z.string().min(1).nullable().default(null),
  reviewed_at: isoDateTime.nullable().default(null),
});
export type Concept = z.infer<typeof ConceptSchema>;

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

// ---------- intake (Fase D2 · W6): enmarcado inicial del discovery ----------

// El wizard configura DENTRO del proceso, no el proceso: las 7 etapas son invariante del
// motor. Lo configurable es el plan de discovery (pregunta, métodos, instrumentos, fuentes
// esperadas). El intake es OPCIONAL en la spec (nullable) → specs previas cargan sin migrar.

export const DiscoveryMethodSchema = z.enum([
  "entrevistas",
  "encuestas",
  "analitica",
  "benchmark",
  "soporte",
  "otros",
]);
export type DiscoveryMethod = z.infer<typeof DiscoveryMethodSchema>;

// Instrumentos de satisfacción (encuestas cuantitativas). Descriptivos: el plan declara qué
// medirá; el Agente 2 los usará para anclar HEART (nps→happiness, ces→task_success,
// csat/isn→happiness) — ese mapeo es trabajo de Definición, no del intake.
export const DiscoveryInstrumentSchema = z.enum([
  "nps",
  "ces",
  "csat",
  "isn",
  "otros",
]);
export type DiscoveryInstrument = z.infer<typeof DiscoveryInstrumentSchema>;

export const DiscoveryPlanSchema = z.object({
  methods: z.array(DiscoveryMethodSchema).default([]),
  instruments: z.array(DiscoveryInstrumentSchema).default([]),
  // Deriva de `methods` por el mapa determinista de abajo, pero es EDITABLE → se persiste
  // explícito (la completitud de Fuentes compara esto vs. lo subido).
  expectedSourceKinds: z.array(SourceKindSchema).default([]),
});
export type DiscoveryPlan = z.infer<typeof DiscoveryPlanSchema>;

export const IntakeSchema = z.object({
  researchQuestion: z.string().min(1), // obligatoria DENTRO del intake
  hypotheses: z.array(z.string().min(1)).default([]),
  productContext: z.string().min(1).nullable().default(null),
  discoveryPlan: DiscoveryPlanSchema.default({
    methods: [],
    instruments: [],
    expectedSourceKinds: [],
  }),
});
export type Intake = z.infer<typeof IntakeSchema>;

// Mapa determinista método → tipos de fuente esperados (default derivable, editable en el
// wizard). `otros` no aporta un tipo específico. Las personas NO derivan de un método.
const METHOD_TO_KINDS: Record<DiscoveryMethod, SourceKind[]> = {
  entrevistas: ["entrevista"],
  encuestas: ["datos"],
  analitica: ["datos"],
  benchmark: ["documento"],
  soporte: ["documento"],
  otros: [],
};

/** Tipos de fuente esperados (unión deduplicada) para un conjunto de métodos de discovery. */
export function deriveExpectedSourceKinds(
  methods: DiscoveryMethod[],
): SourceKind[] {
  const set = new Set<SourceKind>();
  for (const m of methods) for (const k of METHOD_TO_KINDS[m]) set.add(k);
  return [...set];
}

// ---------- la spec ----------

export const SpecSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  // Metadatos de gestión multi-spec (Fase D2 · W0). `product` es un string agrupador
  // (no una entidad; un CRUD de productos es Fase 5). `archived` es el soft-delete:
  // el índice deriva su `status` (activa|archivada) de aquí — la verdad vive en el
  // spec.yaml, el índice es cache regenerable. Defaults para compat con specs previas.
  product: z.string().min(1).default("Sin producto"),
  description: z.string().min(1).nullable().default(null),
  archived: z.boolean().default(false),
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
  concepts: z.array(ConceptSchema).default([]), // Conceptos de solución (Exploración, F3)
  // Enmarcado inicial del discovery (Fase D2 · W6). Opcional: nullable + default(null) →
  // specs previas (otp-onboarding) cargan sin migración; el retrofit lo llena (W6.4).
  intake: IntakeSchema.nullable().default(null),
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
export function createSpecV0(input: {
  id: string;
  title: string;
  product?: string;
  description?: string | null;
}): Spec {
  return {
    id: input.id,
    title: input.title,
    product: input.product ?? "Sin producto",
    description: input.description ?? null,
    archived: false,
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
    concepts: [],
    intake: null,
    history: [],
  };
}
