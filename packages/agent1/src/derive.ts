// Paso "derivar hallazgos" del Agente 1 (invariante 3: DESDE la evidencia, nunca al revés).
// El modelo recibe SOLO el pool de evidencia ya extraída/computada (no los documentos
// crudos) y propone hallazgos citando ids de evidencia. El código re-adjunta la evidencia
// REAL (no la que el modelo reproduzca) y valida cada hallazgo contra FindingSchema:
// quantitative exige computation, qualitative exige quote, y sin evidencia se rechaza.

import Anthropic from "@anthropic-ai/sdk";
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

export interface FindingsProposer {
  propose(input: {
    topic: string;
    evidence: EvidenceItem[];
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
  opts: { topic: string; proposer: FindingsProposer },
): Promise<DerivationResult> {
  const raws = await opts.proposer.propose({
    topic: opts.topic,
    evidence: pool,
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
- Sé conservador: si la evidencia no respalda una afirmación, no la generes.`;

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
  client?: Anthropic;
  model?: string;
  maxTokens?: number;
}

export function createAnthropicFindingsProposer(
  opts: AnthropicFindingsOptions = {},
): FindingsProposer {
  const model = opts.model ?? process.env["PDA_MODEL"] ?? "claude-opus-4-8";
  const maxTokens = opts.maxTokens ?? 4000;
  return {
    async propose({ topic, evidence }) {
      const client = opts.client ?? new Anthropic();
      const user = `Tópico de descubrimiento: ${topic}\n\nPool de evidencia (cita por id):\n${formatPool(evidence)}`;
      const res = await client.messages.create({
        model,
        max_tokens: maxTokens,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: user }],
        output_config: {
          format: { type: "json_schema", schema: FINDINGS_SCHEMA },
        },
      } as Anthropic.MessageCreateParamsNonStreaming);

      const textBlock = res.content.find((b) => b.type === "text");
      const text = textBlock && "text" in textBlock ? textBlock.text : "{}";
      let parsed: { findings?: RawFinding[] };
      try {
        parsed = JSON.parse(text);
      } catch {
        return [];
      }
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
