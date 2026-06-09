// Paso "sintetizar" del Agente 1: promueve los hallazgos validados a la spec y produce
// la propuesta v+1 (spec.proposed.yaml) + una pasada LIGERA de Definición (problem
// statement + métricas tentativas). El modelo redacta; los números provienen solo de la
// evidencia computada; el resultado se valida contra SpecSchema antes de proponerse.

import Anthropic from "@anthropic-ai/sdk";
import { parseSpec, type Finding, type Spec } from "@pda/spec";

export interface SynthesisDraft {
  problem_statement: string;
  outcomes: Array<{
    metric: string;
    baseline: string | null;
    target: string;
    method: string;
  }>;
  in_scope: string[];
  non_goals: string[];
  hypotheses: string[];
}

export interface Synthesizer {
  synthesize(input: {
    topic: string;
    title: string;
    findings: Finding[];
  }): Promise<SynthesisDraft>;
}

/**
 * Ensambla la propuesta v+1 (determinista): clona la spec vigente, promueve los hallazgos
 * a `findings` (marcados validated) y vuelca la Definición ligera. La versión NO sube aquí
 * (eso ocurre al aprobar la compuerta, paso 1.8). Valida contra SpecSchema.
 */
export function assembleProposal(
  current: Spec,
  validatedFindings: Finding[],
  draft: SynthesisDraft,
): Spec {
  const findings: Finding[] = validatedFindings.map((f) => ({
    ...f,
    status: "validated",
  }));

  const tasks = draft.hypotheses.map((h, i) => ({
    id: `H-${String(i + 1).padStart(3, "0")}`,
    description: h,
    stage: "definicion",
    owner: "human" as const,
    status: "todo" as const,
  }));

  const proposed: Spec = {
    ...current,
    status: "in_review",
    problem_statement: draft.problem_statement,
    outcomes: draft.outcomes,
    scope: { in_scope: draft.in_scope, non_goals: draft.non_goals },
    tasks: [...current.tasks, ...tasks],
    findings,
  };

  return parseSpec(proposed); // nunca proponemos una spec inválida
}

/** Sintetiza la propuesta: redacta (modelo) → ensambla y valida (código). */
export async function synthesizeProposal(
  current: Spec,
  validatedFindings: Finding[],
  opts: { topic: string; synthesizer: Synthesizer },
): Promise<Spec> {
  const draft = await opts.synthesizer.synthesize({
    topic: opts.topic,
    title: current.title,
    findings: validatedFindings,
  });
  return assembleProposal(current, validatedFindings, draft);
}

// ---------- synthesizer real: Claude API ----------

const SYNTHESIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "problem_statement",
    "outcomes",
    "in_scope",
    "non_goals",
    "hypotheses",
  ],
  properties: {
    problem_statement: { type: "string" },
    outcomes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["metric", "baseline", "target", "method"],
        properties: {
          metric: { type: "string" },
          baseline: { type: ["string", "null"] },
          target: { type: "string" },
          method: { type: "string" },
        },
      },
    },
    in_scope: { type: "array", items: { type: "string" } },
    non_goals: { type: "array", items: { type: "string" } },
    hypotheses: { type: "array", items: { type: "string" } },
  },
} as const;

const SYSTEM_PROMPT = `Eres un product designer haciendo una pasada LIGERA de Definición a
partir de hallazgos de Descubrimiento YA validados y anclados a evidencia. Produce:
- problem_statement: un enunciado de problema claro y accionable (1-3 frases).
- outcomes: métricas de éxito tentativas (HEART o Goals-Signals-Metrics). El 'baseline'
  SOLO puede usar números que aparezcan en la evidencia (cálculos); si no hay, usa null.
  El 'target' es tentativo (lo fija el humano en la compuerta).
- in_scope / non_goals: alcance conciso, derivado de los hallazgos.
- hypotheses: hipótesis priorizadas a explorar (se vuelven tareas).
Reglas: no inventes números ni datos fuera de la evidencia; sé conservador y conciso.`;

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

export interface AnthropicSynthesizerOptions {
  client?: Anthropic;
  model?: string;
  maxTokens?: number;
}

export function createAnthropicSynthesizer(
  opts: AnthropicSynthesizerOptions = {},
): Synthesizer {
  const model = opts.model ?? process.env["PDA_MODEL"] ?? "claude-opus-4-8";
  const maxTokens = opts.maxTokens ?? 4000;
  return {
    async synthesize({ topic, title, findings }) {
      const client = opts.client ?? new Anthropic();
      const user = `Tópico: ${topic}\nTítulo de la spec: ${title}\n\nHallazgos validados (con su evidencia anclada):\n${formatFindings(findings)}`;
      const res = await client.messages.create({
        model,
        max_tokens: maxTokens,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: user }],
        output_config: {
          format: { type: "json_schema", schema: SYNTHESIS_SCHEMA },
        },
      } as Anthropic.MessageCreateParamsNonStreaming);

      const textBlock = res.content.find((b) => b.type === "text");
      const text = textBlock && "text" in textBlock ? textBlock.text : "{}";
      return JSON.parse(text) as SynthesisDraft;
    },
  };
}
