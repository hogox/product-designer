import { test } from "node:test";
import assert from "node:assert/strict";

import type Anthropic from "@anthropic-ai/sdk";

import { callStructured, resolveModel, makeUsageSink } from "./index.js";

// ─── resolveModel: cadena de overrides ───────────────────────────────────────────

test("resolveModel: override explícito gana a todo", () => {
  process.env["PDA_MODEL_X"] = "from-env";
  process.env["PDA_MODEL"] = "from-pda";
  assert.equal(resolveModel("PDA_MODEL_X", "from-override"), "from-override");
  delete process.env["PDA_MODEL_X"];
  delete process.env["PDA_MODEL"];
});

test("resolveModel: la env var específica gana a PDA_MODEL", () => {
  process.env["PDA_MODEL_X"] = "from-env";
  process.env["PDA_MODEL"] = "from-pda";
  assert.equal(resolveModel("PDA_MODEL_X"), "from-env");
  delete process.env["PDA_MODEL_X"];
  delete process.env["PDA_MODEL"];
});

test("resolveModel: cae a PDA_MODEL si no hay env var específica", () => {
  delete process.env["PDA_MODEL_X"];
  process.env["PDA_MODEL"] = "from-pda";
  assert.equal(resolveModel("PDA_MODEL_X"), "from-pda");
  delete process.env["PDA_MODEL"];
});

test("resolveModel: default claude-opus-4-8 sin ninguna env", () => {
  delete process.env["PDA_MODEL_X"];
  delete process.env["PDA_MODEL"];
  assert.equal(resolveModel("PDA_MODEL_X"), "claude-opus-4-8");
});

// ─── callStructured: cliente inyectado ───────────────────────────────────────────

interface CapturedParams {
  model: string;
  thinking?: unknown;
  output_config?: unknown;
}

function fakeClient(
  responseText: string,
  capture: { params?: CapturedParams },
): Anthropic {
  return {
    messages: {
      create: async (params: CapturedParams) => {
        capture.params = params;
        return {
          usage: { input_tokens: 11, output_tokens: 7 },
          content: [{ type: "text", text: responseText }],
        };
      },
    },
  } as unknown as Anthropic;
}

const SCHEMA = { type: "object" } as Record<string, unknown>;

test("callStructured: parsea el JSON y devuelve usage", async () => {
  const cap: { params?: CapturedParams } = {};
  const { parsed, usage } = await callStructured<{ ok: boolean }>({
    tag: "test",
    model: "claude-opus-4-8",
    system: "s",
    user: "u",
    schema: SCHEMA,
    client: fakeClient('{"ok":true}', cap),
  });
  assert.deepEqual(parsed, { ok: true });
  assert.equal(usage.input_tokens, 11);
  assert.equal(usage.output_tokens, 7);
});

test("callStructured: JSON inválido cae a {} sin lanzar", async () => {
  const cap: { params?: CapturedParams } = {};
  const { parsed } = await callStructured({
    tag: "test",
    model: "claude-opus-4-8",
    system: "s",
    user: "u",
    schema: SCHEMA,
    client: fakeClient("no soy json", cap),
  });
  assert.deepEqual(parsed, {});
});

test("callStructured: incluye thinking:adaptive en modelos que lo soportan", async () => {
  const cap: { params?: CapturedParams } = {};
  await callStructured({
    tag: "test",
    model: "claude-opus-4-8",
    system: "s",
    user: "u",
    schema: SCHEMA,
    client: fakeClient("{}", cap),
  });
  assert.deepEqual(cap.params?.thinking, { type: "adaptive" });
});

test("callStructured: omite thinking en modelos Haiku", async () => {
  const cap: { params?: CapturedParams } = {};
  await callStructured({
    tag: "test",
    model: "claude-haiku-4-5",
    system: "s",
    user: "u",
    schema: SCHEMA,
    client: fakeClient("{}", cap),
  });
  assert.equal(cap.params?.thinking, undefined);
});

test("makeUsageSink: acumula el usage de varias llamadas (Sesión 16)", async () => {
  const cap: { params?: CapturedParams } = {};
  const usage = makeUsageSink();
  // dos llamadas con el mismo fake client (in=11, out=7 cada una)
  await callStructured({
    tag: "a",
    model: "claude-opus-4-8",
    system: "s",
    user: "u",
    schema: SCHEMA,
    client: fakeClient("{}", cap),
    onUsage: usage.onUsage,
  });
  await callStructured({
    tag: "b",
    model: "claude-opus-4-8",
    system: "s",
    user: "u",
    schema: SCHEMA,
    client: fakeClient("{}", cap),
    onUsage: usage.onUsage,
  });
  assert.deepEqual(usage.totals(), { input: 22, output: 14, total: 36 });
});
