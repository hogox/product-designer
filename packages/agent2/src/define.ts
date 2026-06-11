// Agente 2 — Definición. Toma los hallazgos VALIDADOS de Descubrimiento y produce el
// enmarcado completo del problema: problem statement, JTBD y métricas HEART/GSM.
// Procedencia heredada (§D19): cada job cita los findings que lo sustentan; el código
// re-valida que esos ids existan (un job sin sustento real se rechaza). El modelo redacta;
// los baselines provienen solo de la evidencia computada; los targets los fija el humano.

import { callStructured, resolveModel } from "@pda/llm";
import {
  parseSpec,
  type Finding,
  type HeartCategory,
  type Job,
  type Spec,
} from "@pda/spec";

export interface RawJob {
  statement: string;
  supported_by: string[];
}

export interface RawOutcome {
  metric: string;
  baseline: string | null;
  target: string;
  method: string;
  heart: HeartCategory | null;
  signals: string[];
}

export interface RawDefinition {
  problem_statement: string;
  jobs: RawJob[];
  outcomes: RawOutcome[];
}

export interface Definer {
  define(input: {
    topic: string;
    title: string;
    findings: Finding[];
    feedback?: string;
  }): Promise<RawDefinition>;
}

export interface DefinitionResult {
  proposed: Spec;
  rejectedJobs: Array<{ raw: RawJob; reason: string }>;
}

/**
 * Ensambla la propuesta de Definición (determinista): valida que los jobs citen findings
 * reales (procedencia), asigna ids J-xxx, enriquece outcomes (HEART + señales) y vuelca el
 * problem statement. No sube versión (eso es la compuerta). Valida contra SpecSchema.
 */
export function assembleDefinition(
  current: Spec,
  findings: Finding[],
  raw: RawDefinition,
): DefinitionResult {
  const findingIds = new Set(findings.map((f) => f.id));
  const jobs: Job[] = [];
  const rejectedJobs: Array<{ raw: RawJob; reason: string }> = [];
  let counter = 0;

  for (const j of raw.jobs) {
    const supported = [...new Set(j.supported_by)].filter((id) =>
      findingIds.has(id),
    );
    if (supported.length === 0) {
      rejectedJobs.push({
        raw: j,
        reason: "no referencia findings válidos (sin procedencia)",
      });
      continue;
    }
    counter++;
    jobs.push({
      id: `J-${String(counter).padStart(3, "0")}`,
      statement: j.statement,
      supported_by: supported,
    });
  }

  const proposed: Spec = {
    ...current,
    status: "in_review",
    current_stage: "definicion",
    problem_statement: raw.problem_statement,
    outcomes: raw.outcomes,
    jtbd: jobs,
    findings: findings.map((f) => ({ ...f, status: "validated" })),
  };

  return { proposed: parseSpec(proposed), rejectedJobs };
}

/** Define el problema: redacta (modelo, desde los findings) → ensambla y valida (código). */
export async function defineProblem(
  current: Spec,
  findings: Finding[],
  opts: { topic: string; definer: Definer; feedback?: string },
): Promise<DefinitionResult> {
  const raw = await opts.definer.define({
    topic: opts.topic,
    title: current.title,
    findings,
    feedback: opts.feedback,
  });
  return assembleDefinition(current, findings, raw);
}

// ---------- definer real: Claude API ----------

const DEFINITION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["problem_statement", "jobs", "outcomes"],
  properties: {
    problem_statement: { type: "string" },
    jobs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["statement", "supported_by"],
        properties: {
          statement: { type: "string" },
          supported_by: { type: "array", items: { type: "string" } },
        },
      },
    },
    outcomes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "metric",
          "baseline",
          "target",
          "method",
          "heart",
          "signals",
        ],
        properties: {
          metric: { type: "string" },
          baseline: { type: ["string", "null"] },
          target: { type: "string" },
          method: { type: "string" },
          heart: {
            type: "string",
            enum: [
              "happiness",
              "engagement",
              "adoption",
              "retention",
              "task_success",
            ],
          },
          signals: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `Eres un product designer cerrando la etapa de Definición a partir de
hallazgos de Descubrimiento YA validados y anclados a evidencia. Produce el enmarcado
completo del problema:
- problem_statement: enunciado claro y accionable (1-3 frases), derivado de los hallazgos.
- jobs (JTBD): cada job en formato "Cuando [situación], quiero [motivación], para [resultado]".
  Cada job DEBE citar en supported_by los ids de los findings que lo motivan (p. ej. ["F-001"]).
- outcomes (métricas HEART/GSM): metric, method, y categoría 'heart' (una de: happiness/
  engagement/adoption/retention/task_success), más 'signals' (señales observables).
  El 'baseline' SOLO puede usar números que aparezcan en la evidencia (cálculos); si no hay, null.
  El 'target' es tentativo (lo fija el humano en la compuerta).
Reglas: no inventes números ni datos fuera de la evidencia; cita findings reales; sé conciso.`;

function formatFindings(findings: Finding[]): string {
  return findings
    .map((f) => {
      const anchors = f.evidence
        .map((e) => (e.quote ? `"${e.quote}"` : e.computation))
        .join(" | ");
      return `[${f.id}] (${f.type}) ${f.statement}  ←  ${anchors}`;
    })
    .join("\n");
}

export interface AnthropicDefinerOptions {
  model?: string;
  maxTokens?: number;
}

export function createAnthropicDefiner(
  opts: AnthropicDefinerOptions = {},
): Definer {
  const model = resolveModel("PDA_MODEL", opts.model);
  return {
    async define({ topic, title, findings, feedback }) {
      const feedbackBlock = feedback
        ? `\nFeedback de iteración (a incorporar en esta propuesta):\n${feedback}\n`
        : "";
      const user = `Tópico: ${topic}\nTítulo de la spec: ${title}\n\nHallazgos validados (con su evidencia anclada):\n${formatFindings(findings)}${feedbackBlock}`;

      const { parsed } = await callStructured<RawDefinition>({
        tag: "define",
        model,
        system: SYSTEM_PROMPT,
        user,
        schema: DEFINITION_SCHEMA as Record<string, unknown>,
        maxTokens: opts.maxTokens,
      });

      return parsed;
    },
  };
}
