// Paso "derivar hallazgos" del Agente 1 (invariante 3: DESDE la evidencia, nunca al revés).
// El modelo recibe SOLO el pool de evidencia ya extraída/computada (no los documentos
// crudos) y propone hallazgos citando ids de evidencia. El código re-adjunta la evidencia
// REAL (no la que el modelo reproduzca) y valida cada hallazgo contra FindingSchema:
// quantitative exige computation, qualitative exige quote, y sin evidencia se rechaza.

import { callStructured, resolveModel } from "@pda/llm";
import {
  FindingSchema,
  type Evidence,
  type Finding,
  type FindingType,
  type Confidence,
  type FindingFeeds,
} from "@pda/spec";

export interface EvidenceItem {
  id: string; // p. ej. "E-001"
  evidence: Evidence;
}

export interface RawFinding {
  statement: string;
  type: FindingType;
  confidence: Confidence;
  feeds: FindingFeeds;
  evidence_ids: string[];
}

// Grounding del intake (Fase D2 · W6.2): orienta QUÉ hallazgos derivar del pool ya fijo.
// Entra SOLO en la derivación, NUNCA en la extracción de evidencia (invariante 3): la
// evidencia se extrae sin sesgo; la pregunta solo prioriza el foco al derivar.
export interface DerivationGrounding {
  researchQuestion: string;
  productContext?: string | null;
  hypotheses?: string[];
}

export interface FindingsProposer {
  propose(input: {
    topic: string;
    evidence: EvidenceItem[];
    grounding?: DerivationGrounding;
  }): Promise<RawFinding[]>;
}

export interface DerivationResult {
  accepted: Finding[];
  rejected: Array<{ raw: RawFinding; reason: string }>;
}

/** Construye un pool de evidencia con ids estables a partir de evidencias ancladas. */
export function buildEvidencePool(parts: Evidence[]): EvidenceItem[] {
  return parts.map((evidence, i) => ({
    id: `E-${String(i + 1).padStart(3, "0")}`,
    evidence,
  }));
}

/**
 * Ensambla y valida hallazgos desde las propuestas del modelo. La evidencia se toma del
 * pool por id (no se confía en que el modelo la reproduzca). Un hallazgo cuya evidencia no
 * existe en el pool, o que viola FindingSchema, se rechaza con motivo.
 */
export function assembleFindings(
  pool: EvidenceItem[],
  raws: RawFinding[],
): DerivationResult {
  const byId = new Map(pool.map((e) => [e.id, e.evidence]));
  const accepted: Finding[] = [];
  const rejected: Array<{ raw: RawFinding; reason: string }> = [];
  let counter = 0;

  for (const raw of raws) {
    const ids = [...new Set(raw.evidence_ids)];
    const evidence = ids
      .map((id) => byId.get(id))
      .filter((e): e is Evidence => e !== undefined);

    if (evidence.length === 0) {
      rejected.push({
        raw,
        reason: "no referencia evidencia válida del pool (sin fuente anclada)",
      });
      continue;
    }

    const candidate = {
      id: `F-${String(counter + 1).padStart(3, "0")}`,
      statement: raw.statement,
      type: raw.type,
      evidence,
      confidence: raw.confidence,
      status: "proposed" as const,
      feeds: raw.feeds,
      reviewed_by: null,
      review_note: null,
    };

    const parsed = FindingSchema.safeParse(candidate);
    if (!parsed.success) {
      rejected.push({
        raw,
        reason: parsed.error.issues[0]?.message ?? "hallazgo inválido",
      });
      continue;
    }
    accepted.push(parsed.data);
    counter++;
  }

  return { accepted, rejected };
}

/** Deriva hallazgos: propone (modelo, solo desde el pool) → ensambla y valida (código). */
export async function deriveFindings(
  pool: EvidenceItem[],
  opts: {
    topic: string;
    proposer: FindingsProposer;
    grounding?: DerivationGrounding;
  },
): Promise<DerivationResult> {
  const raws = await opts.proposer.propose({
    topic: opts.topic,
    evidence: pool,
    grounding: opts.grounding,
  });
  return assembleFindings(pool, raws);
}

// ---------- proposer real: Claude API ----------

const FINDINGS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["statement", "type", "confidence", "feeds", "evidence_ids"],
        properties: {
          statement: { type: "string" },
          type: { type: "string", enum: ["qualitative", "quantitative"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          feeds: {
            type: "string",
            enum: ["outcomes", "constraints", "hypothesis", "scope"],
          },
          evidence_ids: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `Eres un analista de research de producto. Derivas HALLAZGOS a partir
de un POOL DE EVIDENCIA ya anclada (citas textuales y cálculos deterministas). Reglas:
- Cada hallazgo se deriva ÚNICAMENTE de la evidencia provista; cita sus evidence_ids.
- No inventes evidencia ni números. No uses información fuera del pool.
- Un hallazgo "quantitative" debe citar al menos una evidencia de tipo cálculo (computation).
- Un hallazgo "qualitative" debe citar al menos una evidencia de tipo cita (quote).
- 'feeds' indica a qué parte de la spec alimentaría: outcomes, constraints, hypothesis o scope.
- Sé conservador: si la evidencia no respalda una afirmación, no la generes.
- Si se provee una PREGUNTA DE DISCOVERY, prioriza derivar los hallazgos que la respondan
  (relevancia y orden), pero SIN forzar: si la evidencia no toca la pregunta, deriva igual lo
  que la evidencia sí respalde. La pregunta orienta el FOCO; nunca inventa ni sesga evidencia.`;

function formatPool(pool: EvidenceItem[]): string {
  return pool
    .map((e) => {
      const kind = e.evidence.computation ? "cálculo" : "cita";
      const payload = e.evidence.computation ?? `"${e.evidence.quote}"`;
      return `[${e.id}] (${kind}) ${e.evidence.source} · ${e.evidence.locator}: ${payload}`;
    })
    .join("\n");
}

export interface AnthropicFindingsOptions {
  model?: string;
  maxTokens?: number;
}

export function createAnthropicFindingsProposer(
  opts: AnthropicFindingsOptions = {},
): FindingsProposer {
  const model = resolveModel("PDA_MODEL", opts.model);
  return {
    async propose({ topic, evidence, grounding }) {
      const groundingBlock = grounding
        ? `Pregunta de discovery: ${grounding.researchQuestion}\n` +
          (grounding.productContext
            ? `Contexto de producto: ${grounding.productContext}\n`
            : "") +
          (grounding.hypotheses && grounding.hypotheses.length > 0
            ? `Hipótesis a contrastar:\n${grounding.hypotheses.map((h) => ` - ${h}`).join("\n")}\n`
            : "") +
          "\n"
        : "";
      const user =
        `Tópico de descubrimiento: ${topic}\n\n` +
        groundingBlock +
        `Pool de evidencia (cita por id):\n${formatPool(evidence)}`;

      const { parsed } = await callStructured<{ findings?: RawFinding[] }>({
        tag: "derive",
        model,
        system: SYSTEM_PROMPT,
        user,
        schema: FINDINGS_SCHEMA as Record<string, unknown>,
        maxTokens: opts.maxTokens,
      });

      return (parsed.findings ?? []).map((f) => ({
        statement: String(f.statement),
        type: f.type,
        confidence: f.confidence,
        feeds: f.feeds,
        evidence_ids: Array.isArray(f.evidence_ids)
          ? f.evidence_ids.map(String)
          : [],
      }));
    },
  };
}
