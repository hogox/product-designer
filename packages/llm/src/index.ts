// @pda/llm — helper compartido para llamadas estructuradas a Claude.
// Centraliza: cliente Anthropic, adaptive thinking, output_config json_schema,
// logging de tokens en stderr y parse con fallback. Un agente nuevo = ~30 líneas.

import Anthropic from "@anthropic-ai/sdk";

export interface StructuredCallOptions {
  /** Etiqueta para el log [tokens:<tag>] */
  tag: string;
  model: string;
  system: string;
  user: string;
  /** JSON Schema del output (para output_config.format.json_schema). */
  schema: Record<string, unknown>;
  maxTokens?: number;
  /** Inyectable para tests que mockean el cliente. */
  client?: Anthropic;
}

export interface StructuredCallResult<T> {
  parsed: T;
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * Llama a Claude con structured output y adaptive thinking; loguea tokens en stderr.
 * Devuelve el objeto parseado + usage. Si el JSON no parsea, devuelve `{}` casteado.
 */
export async function callStructured<T>(
  opts: StructuredCallOptions,
): Promise<StructuredCallResult<T>> {
  const client = opts.client ?? new Anthropic();
  const maxTokens = opts.maxTokens ?? 4000;

  // Haiku no soporta adaptive thinking; solo Opus/Sonnet/Fable lo soportan.
  const supportsThinking = !/haiku/i.test(opts.model);

  const res = await (client.messages.create as (
    p: Anthropic.MessageCreateParamsNonStreaming,
  ) => Promise<Anthropic.Message>)({
    model: opts.model,
    max_tokens: maxTokens,
    ...(supportsThinking ? { thinking: { type: "adaptive" } } : {}),
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    output_config: {
      format: { type: "json_schema", schema: opts.schema },
    },
  });

  const { input_tokens, output_tokens } = res.usage;
  process.stderr.write(
    `[tokens:${opts.tag}] in=${input_tokens} out=${output_tokens} total=${input_tokens + output_tokens} model=${opts.model}\n`,
  );

  const textBlock = res.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "{}";
  let parsed: T;
  try {
    parsed = JSON.parse(text) as T;
  } catch {
    parsed = {} as T;
  }
  return { parsed, usage: { input_tokens, output_tokens } };
}

/** Resuelve el modelo con la cadena de env vars estándar del proyecto. */
export function resolveModel(
  envVar: string,
  override?: string,
): string {
  return (
    override ??
    process.env[envVar] ??
    process.env["PDA_MODEL"] ??
    "claude-opus-4-8"
  );
}
