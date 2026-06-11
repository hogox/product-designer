// Paso "extraer evidencia" del Agente 1 (invariante 3: anclar ANTES de concluir).
// El modelo propone CITAS TEXTUALES; cada una se verifica como substring real de la
// fuente y su locator se DERIVA de dónde aparece de verdad (no se confía en el modelo).
// Una cita que no existe en la fuente se rechaza (anti back-fill).

import type { Evidence } from "@pda/spec";
import { callStructured, resolveModel } from "@pda/llm";

import type { TextDocument, TextSegment } from "./ingest.js";

export interface RawEvidenceCandidate {
  quote: string;
}

/** Proveedor de candidatos de cita (inyectable: real = Anthropic, stub = tests offline). */
export interface EvidenceProposer {
  propose(input: {
    source: string;
    topic: string;
    segments: TextSegment[];
  }): Promise<RawEvidenceCandidate[]>;
}

export interface RejectedCandidate {
  candidate: RawEvidenceCandidate;
  reason: string;
}

export interface ExtractionResult {
  accepted: Evidence[]; // evidencia cualitativa anclada (quote + locator verificados)
  rejected: RejectedCandidate[]; // citas que no existen en la fuente (no se promueven)
}

const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Busca el locator real de una cita: el del segmento que la contiene; null si no existe. */
function resolveLocator(doc: TextDocument, quote: string): string | null {
  const q = norm(quote);
  if (q.length === 0) return null;
  for (const seg of doc.segments) {
    if (norm(seg.text).includes(q)) return seg.locator;
  }
  // existe en el documento pero cruza fronteras de segmento
  if (norm(doc.fullText).includes(q)) return "documento";
  return null;
}

/**
 * Verifica los candidatos contra la fuente. Devuelve la evidencia aceptada (con locator
 * real derivado) y la rechazada (cita inexistente). No deriva hallazgos: eso es el paso 1.5.
 */
export function verifyCandidates(
  doc: TextDocument,
  candidates: RawEvidenceCandidate[],
): ExtractionResult {
  const accepted: Evidence[] = [];
  const rejected: RejectedCandidate[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const locator = resolveLocator(doc, c.quote);
    if (locator === null) {
      rejected.push({
        candidate: c,
        reason:
          "la cita no existe textualmente en la fuente (posible alucinación)",
      });
      continue;
    }
    const key = `${locator}::${norm(c.quote)}`;
    if (seen.has(key)) continue; // deduplica
    seen.add(key);
    accepted.push({ source: doc.source, locator, quote: c.quote.trim() });
  }
  return { accepted, rejected };
}

/** Extrae evidencia de un documento de texto: propone (modelo) → verifica (código). */
export async function extractTextEvidence(
  doc: TextDocument,
  opts: { topic: string; proposer: EvidenceProposer },
): Promise<ExtractionResult> {
  const candidates = await opts.proposer.propose({
    source: doc.source,
    topic: opts.topic,
    segments: doc.segments,
  });
  return verifyCandidates(doc, candidates);
}

// ---------- proposer real: Claude API ----------

const EVIDENCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["evidence"],
  properties: {
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["quote"],
        properties: {
          quote: { type: "string" },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `Eres un extractor de evidencia para research de producto.
Tu única tarea es EXTRAER CITAS TEXTUALES VERBATIM relevantes al tópico, copiadas EXACTAMENTE del texto provisto (sin parafrasear, sin corregir ortografía, sin resumir).
Reglas:
- Copia la cita carácter por carácter desde un fragmento; debe poder encontrarse como substring exacto.
- No inventes ni infieras. Si un fragmento no aporta evidencia relevante, omítelo.
- Si no hay nada relevante, devuelve una lista vacía.
No deduzcas conclusiones ni hallazgos: solo extrae las frases ancladas.`;

export interface AnthropicProposerOptions {
  model?: string;
  maxTokens?: number;
}

export function createAnthropicProposer(
  opts: AnthropicProposerOptions = {},
): EvidenceProposer {
  const model = resolveModel("PDA_MODEL_EXTRACT", opts.model);
  return {
    async propose({ source, topic, segments }) {
      const fragments = segments
        .map((s) => `[${s.locator}] ${s.text}`)
        .join("\n");
      const user = `Tópico de descubrimiento: ${topic}\nFuente: ${source}\n\nFragmentos (cada uno precedido por su [locator]):\n${fragments}`;

      const { parsed } = await callStructured<{
        evidence?: Array<{ quote?: unknown }>;
      }>({
        tag: `extract:${source}`,
        model,
        system: SYSTEM_PROMPT,
        user,
        schema: EVIDENCE_SCHEMA as Record<string, unknown>,
        maxTokens: opts.maxTokens,
      });

      return (parsed.evidence ?? [])
        .filter((e) => typeof e.quote === "string")
        .map((e) => ({ quote: String(e.quote) }));
    },
  };
}
