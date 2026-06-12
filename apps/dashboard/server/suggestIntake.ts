// Sugerencia de intake con IA (Sesión 17): a partir del nombre/producto/descripción del
// problema, genera un borrador de enmarcado (researchQuestion, hypotheses, productContext,
// methods, instruments). El humano lo edita, acepta o regenera. No persiste nada.
// expectedSourceKinds NO se genera: se computa determinísticamente server-side (invariante 4).

import Anthropic from "@anthropic-ai/sdk";
import { callStructured, resolveModel, type CallUsage } from "@pda/llm";
import type { DiscoveryMethod, DiscoveryInstrument } from "@pda/spec";

export interface IntakeSuggestion {
  researchQuestion: string;
  hypotheses: string[];
  productContext: string | null;
  methods: DiscoveryMethod[];
  instruments: DiscoveryInstrument[];
}

const SYSTEM = `Eres un experto en UX research y product discovery. Dado el nombre, producto \
y descripción de un problema de producto, genera el enmarcado inicial para una investigación de usuarios.

Reglas:
- researchQuestion: una pregunta específica y accionable que guíe la investigación. Empieza con ¿Por qué, ¿Qué, ¿Cómo o ¿Cuánto.
- hypotheses: entre 2 y 4 hipótesis falsables y concretas sobre el problema.
- productContext: 1-2 frases de contexto del producto/usuarios si hay información suficiente, o null.
- methods: los métodos de discovery más apropiados. Solo valores del enum.
- instruments: instrumentos de satisfacción (nps/ces/csat/isn) solo si aplican claramente; array vacío si no.`;

const SCHEMA = {
  type: "object",
  required: ["researchQuestion", "hypotheses", "methods", "instruments"],
  additionalProperties: false,
  properties: {
    researchQuestion: { type: "string" },
    hypotheses: { type: "array", items: { type: "string" } },
    productContext: { type: ["string", "null"] },
    methods: {
      type: "array",
      items: {
        type: "string",
        enum: ["entrevistas", "encuestas", "analitica", "benchmark", "soporte", "otros"],
      },
    },
    instruments: {
      type: "array",
      items: { type: "string", enum: ["nps", "ces", "csat", "isn", "otros"] },
    },
  },
};

const VALID_METHODS = new Set<string>(["entrevistas", "encuestas", "analitica", "benchmark", "soporte", "otros"]);
const VALID_INSTRUMENTS = new Set<string>(["nps", "ces", "csat", "isn", "otros"]);

export async function suggestIntake(
  input: { name: string; product: string; description: string | null },
  opts: { client?: Anthropic; model?: string } = {},
): Promise<{ suggestion: IntakeSuggestion; usage: CallUsage }> {
  const model = resolveModel("PDA_MODEL_INTAKE", opts.model, "claude-haiku-4-5-20251001");
  const lines = [
    `Nombre del problema: ${input.name}`,
    `Producto: ${input.product}`,
    ...(input.description ? [`Descripción: ${input.description}`] : []),
  ];

  const { parsed, usage } = await callStructured<Record<string, unknown>>({
    tag: "suggest-intake",
    model,
    system: SYSTEM,
    user: lines.join("\n"),
    schema: SCHEMA,
    maxTokens: 1024,
    client: opts.client,
  });

  const suggestion: IntakeSuggestion = {
    researchQuestion:
      typeof parsed.researchQuestion === "string" ? parsed.researchQuestion.trim() : "",
    hypotheses: Array.isArray(parsed.hypotheses)
      ? (parsed.hypotheses as unknown[])
          .filter((h): h is string => typeof h === "string" && h.trim().length > 0)
          .map((h) => h.trim())
      : [],
    productContext:
      typeof parsed.productContext === "string" && parsed.productContext.trim().length > 0
        ? parsed.productContext.trim()
        : null,
    methods: Array.isArray(parsed.methods)
      ? (parsed.methods as unknown[]).filter(
          (m): m is DiscoveryMethod => typeof m === "string" && VALID_METHODS.has(m),
        )
      : [],
    instruments: Array.isArray(parsed.instruments)
      ? (parsed.instruments as unknown[]).filter(
          (i): i is DiscoveryInstrument => typeof i === "string" && VALID_INSTRUMENTS.has(i),
        )
      : [],
  };

  return { suggestion, usage };
}
