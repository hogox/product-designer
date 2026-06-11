// Agente 3 — Exploración. Abre el diamante de la Solución: dada la Definición aprobada
// (problem statement + JTBD), genera conceptos de solución anclados a los jobs.
// Invariante 3: el modelo propone solo ids de jobs; el código valida que existan y re-adjunta
// el job real. Un concepto sin jobs reales se rechaza.

import { callStructured, resolveModel, type CallUsage } from "@pda/llm";
import { ConceptSchema, type Concept, type Job } from "@pda/spec";

export interface RawConcept {
  title: string;
  description: string;
  rationale: string;
  addresses_jtbd: string[];
}

/**
 * Contexto de producto para orientar la divergencia (P5). NO viola la invariante 3: esa regla
 * prohíbe sesgar la EXTRACCIÓN de evidencia; en Exploración no hay extracción — los conceptos
 * son síntesis creativa sobre JTBD ya validados, y este contexto evita conceptos fuera de alcance.
 */
export interface ConceptContext {
  productContext?: string;
  hypotheses?: string[];
  constraints?: string[];
  nonGoals?: string[];
}

export interface ConceptProposer {
  propose(input: {
    topic: string;
    problemStatement: string;
    jobs: Job[];
    discardedFeedback?: string;
    context?: ConceptContext;
  }): Promise<RawConcept[]>;
}

export interface ExplorationResult {
  accepted: Concept[];
  rejected: Array<{ raw: RawConcept; reason: string }>;
}

/**
 * Ensambla y valida conceptos desde las propuestas del modelo. Los jobs se toman por id
 * del set validado (no se confía en que el modelo los reproduzca). Un concepto que cita solo
 * jobs inexistentes se rechaza; el schema Zod valida el resto.
 */
export function assembleConcepts(
  jobs: Job[],
  raws: RawConcept[],
  opts: { firstId?: number } = {},
): ExplorationResult {
  const jobIds = new Set(jobs.map((j) => j.id));
  const accepted: Concept[] = [];
  const rejected: Array<{ raw: RawConcept; reason: string }> = [];
  // Los ids arrancan en firstId (default 1) para no reciclar ids ya emitidos al re-explorar.
  let counter = (opts.firstId ?? 1) - 1;

  for (const raw of raws) {
    const validJtbd = [...new Set(raw.addresses_jtbd)].filter((id) =>
      jobIds.has(id),
    );
    if (validJtbd.length === 0) {
      rejected.push({
        raw,
        reason: "no referencia jobs válidos de la spec (sin procedencia JTBD)",
      });
      continue;
    }

    const candidate = {
      id: `C-${String(counter + 1).padStart(3, "0")}`,
      title: raw.title,
      description: raw.description,
      rationale: raw.rationale,
      addresses_jtbd: validJtbd,
      review_status: "propuesto" as const,
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    };

    const parsed = ConceptSchema.safeParse(candidate);
    if (!parsed.success) {
      rejected.push({
        raw,
        reason: parsed.error.issues[0]?.message ?? "concepto inválido",
      });
      continue;
    }
    accepted.push(parsed.data);
    counter++;
  }

  return { accepted, rejected };
}

/** Explora conceptos: propone (modelo) → ensambla y valida (código). */
export async function exploreConceptsFromJobs(
  jobs: Job[],
  opts: {
    topic: string;
    problemStatement: string;
    proposer: ConceptProposer;
    discardedFeedback?: string;
    /** Primer id a asignar (P3: continúa la numeración al re-explorar). */
    firstId?: number;
    /** Contexto de producto para orientar la divergencia (P5). */
    context?: ConceptContext;
  },
): Promise<ExplorationResult> {
  const raws = await opts.proposer.propose({
    topic: opts.topic,
    problemStatement: opts.problemStatement,
    jobs,
    discardedFeedback: opts.discardedFeedback,
    context: opts.context,
  });
  return assembleConcepts(jobs, raws, { firstId: opts.firstId });
}

// ---------- proposer real: Claude API ----------

const CONCEPTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["concepts"],
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "rationale", "addresses_jtbd"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          rationale: { type: "string" },
          addresses_jtbd: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `Eres un product designer abriendo el diamante de la Solución.
A partir del problem statement y los jobs JTBD validados, genera CONCEPTOS DE SOLUCIÓN:
direcciones de diseño divergentes, no prototipos detallados.
Reglas:
- Cada concepto necesita: title (nombre corto), description (qué es la solución en 2-4 frases),
  rationale (por qué aborda los jobs citados), addresses_jtbd (lista de ids J-xxx exactos).
- Cita SOLO los ids de jobs que aparecen en la lista provista (J-001, J-002, …).
- Genera entre 3 y 6 conceptos divergentes; no repitas el mismo enfoque con distintas palabras.
- No inventes datos ni asumas restricciones técnicas no mencionadas.
- Si se provee feedback de conceptos descartados, evita repetir esos enfoques y explica
  en el rationale cómo difiere el nuevo concepto.`;

function formatJobs(jobs: Job[]): string {
  return jobs.map((j) => `[${j.id}] ${j.statement}`).join("\n");
}

/** Bloque de contexto de producto (P5): vacío si no hay nada que aportar. */
function formatContext(ctx?: ConceptContext): string {
  if (!ctx) return "";
  const parts: string[] = [];
  if (ctx.productContext)
    parts.push(`Contexto de producto:\n${ctx.productContext}`);
  if (ctx.hypotheses && ctx.hypotheses.length > 0)
    parts.push(`Hipótesis a tener en cuenta:\n- ${ctx.hypotheses.join("\n- ")}`);
  if (ctx.constraints && ctx.constraints.length > 0)
    parts.push(
      `Restricciones a respetar (no las violes en los conceptos):\n- ${ctx.constraints.join("\n- ")}`,
    );
  if (ctx.nonGoals && ctx.nonGoals.length > 0)
    parts.push(
      `Fuera de alcance (no propongas conceptos sobre esto):\n- ${ctx.nonGoals.join("\n- ")}`,
    );
  return parts.length > 0 ? `\n\n${parts.join("\n\n")}\n` : "";
}

export interface AnthropicExplorerOptions {
  model?: string;
  maxTokens?: number;
  onUsage?: (usage: CallUsage) => void;
}

export function createAnthropicExplorer(
  opts: AnthropicExplorerOptions = {},
): ConceptProposer {
  const model = resolveModel("PDA_MODEL_EXPLORE", opts.model);
  return {
    async propose({
      topic,
      problemStatement,
      jobs,
      discardedFeedback,
      context,
    }) {
      const feedbackBlock = discardedFeedback
        ? `\nConceptos descartados (no repetir estos enfoques):\n${discardedFeedback}\n`
        : "";
      const contextBlock = formatContext(context);
      const user =
        `Tópico: ${topic}\n\n` +
        `Problem statement:\n${problemStatement}\n\n` +
        `Jobs To Be Done:\n${formatJobs(jobs)}` +
        contextBlock +
        feedbackBlock;

      const { parsed } = await callStructured<{ concepts?: RawConcept[] }>({
        tag: "explore",
        model,
        system: SYSTEM_PROMPT,
        user,
        schema: CONCEPTS_SCHEMA as Record<string, unknown>,
        maxTokens: opts.maxTokens,
        onUsage: opts.onUsage,
      });

      return (parsed.concepts ?? []).map((c) => ({
        title: String(c.title),
        description: String(c.description),
        rationale: String(c.rationale),
        addresses_jtbd: Array.isArray(c.addresses_jtbd)
          ? c.addresses_jtbd.map(String)
          : [],
      }));
    },
  };
}
