// Agente 3 — Exploración. Abre el diamante de la Solución: dada la Definición aprobada
// (problem statement + JTBD), genera conceptos de solución anclados a los jobs.
// Invariante 3: el modelo propone solo ids de jobs; el código valida que existan y re-adjunta
// el job real. Un concepto sin jobs reales se rechaza.

import { callStructured, resolveModel } from "@pda/llm";
import { ConceptSchema, type Concept, type Job } from "@pda/spec";

export interface RawConcept {
  title: string;
  description: string;
  rationale: string;
  addresses_jtbd: string[];
}

export interface ConceptProposer {
  propose(input: {
    topic: string;
    problemStatement: string;
    jobs: Job[];
    discardedFeedback?: string;
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
): ExplorationResult {
  const jobIds = new Set(jobs.map((j) => j.id));
  const accepted: Concept[] = [];
  const rejected: Array<{ raw: RawConcept; reason: string }> = [];
  let counter = 0;

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
  },
): Promise<ExplorationResult> {
  const raws = await opts.proposer.propose({
    topic: opts.topic,
    problemStatement: opts.problemStatement,
    jobs,
    discardedFeedback: opts.discardedFeedback,
  });
  return assembleConcepts(jobs, raws);
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

export interface AnthropicExplorerOptions {
  model?: string;
  maxTokens?: number;
}

export function createAnthropicExplorer(
  opts: AnthropicExplorerOptions = {},
): ConceptProposer {
  const model = resolveModel("PDA_MODEL_EXPLORE", opts.model);
  return {
    async propose({ topic, problemStatement, jobs, discardedFeedback }) {
      const feedbackBlock = discardedFeedback
        ? `\nConceptos descartados (no repetir estos enfoques):\n${discardedFeedback}\n`
        : "";
      const user =
        `Tópico: ${topic}\n\n` +
        `Problem statement:\n${problemStatement}\n\n` +
        `Jobs To Be Done:\n${formatJobs(jobs)}` +
        feedbackBlock;

      const { parsed } = await callStructured<{ concepts?: RawConcept[] }>({
        tag: "explore",
        model,
        system: SYSTEM_PROMPT,
        user,
        schema: CONCEPTS_SCHEMA as Record<string, unknown>,
        maxTokens: opts.maxTokens,
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
