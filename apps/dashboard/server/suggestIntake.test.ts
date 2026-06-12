import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";

import { suggestIntake } from "./suggestIntake.ts";

function mockClient(text: string): Anthropic {
  return {
    messages: {
      create: async () => ({
        content: [{ type: "text", text }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    },
  } as unknown as Anthropic;
}

test("suggestIntake: retorna borrador válido con todos los campos", async () => {
  const payload = {
    researchQuestion: "¿Por qué los usuarios abandonan el checkout?",
    hypotheses: ["El precio final sorprende al usuario", "El proceso es demasiado largo"],
    productContext: "Checkout de e-commerce con ~40k usuarios/mes",
    methods: ["entrevistas", "analitica"],
    instruments: ["ces"],
  };
  const { suggestion, usage } = await suggestIntake(
    {
      name: "Abandono checkout",
      product: "Pagos",
      description: "Alta tasa de abandono en el paso final de pago",
    },
    { client: mockClient(JSON.stringify(payload)), model: "claude-haiku-4-5-20251001" },
  );
  assert.equal(suggestion.researchQuestion, payload.researchQuestion);
  assert.deepEqual(suggestion.hypotheses, payload.hypotheses);
  assert.equal(suggestion.productContext, payload.productContext);
  assert.deepEqual(suggestion.methods, ["entrevistas", "analitica"]);
  assert.deepEqual(suggestion.instruments, ["ces"]);
  assert.equal(usage.input_tokens, 10);
  assert.equal(usage.output_tokens, 20);
});

test("suggestIntake: filtra enums inválidos que el modelo pueda inventar", async () => {
  const payload = {
    researchQuestion: "¿Cómo mejoramos el onboarding?",
    hypotheses: ["h1"],
    productContext: null,
    methods: ["entrevistas", "etnografia_invalida"],
    instruments: ["nps", "termometro_invalido"],
  };
  const { suggestion } = await suggestIntake(
    { name: "Onboarding", product: "App", description: null },
    { client: mockClient(JSON.stringify(payload)), model: "claude-haiku-4-5-20251001" },
  );
  assert.deepEqual(suggestion.methods, ["entrevistas"]);
  assert.deepEqual(suggestion.instruments, ["nps"]);
});

test("suggestIntake: productContext null cuando el modelo lo omite o devuelve vacío", async () => {
  const payload = {
    researchQuestion: "¿Qué frena la adopción?",
    hypotheses: ["h1"],
    productContext: null,
    methods: ["benchmark"],
    instruments: [],
  };
  const { suggestion } = await suggestIntake(
    { name: "Adopción", product: "B2B SaaS", description: null },
    { client: mockClient(JSON.stringify(payload)), model: "claude-haiku-4-5-20251001" },
  );
  assert.equal(suggestion.productContext, null);
});

test("suggestIntake: JSON inválido → campos vacíos sin crash", async () => {
  const { suggestion } = await suggestIntake(
    { name: "Test", product: "App", description: null },
    { client: mockClient("NO ES JSON VALIDO"), model: "claude-haiku-4-5-20251001" },
  );
  assert.equal(suggestion.researchQuestion, "");
  assert.deepEqual(suggestion.hypotheses, []);
  assert.deepEqual(suggestion.methods, []);
  assert.deepEqual(suggestion.instruments, []);
});

test("suggestIntake: trimea espacios en researchQuestion e hipótesis", async () => {
  const payload = {
    researchQuestion: "  ¿Por qué falla?  ",
    hypotheses: ["  hipótesis con espacios  ", "  "],
    productContext: "  contexto  ",
    methods: ["encuestas"],
    instruments: [],
  };
  const { suggestion } = await suggestIntake(
    { name: "Falla", product: "App", description: null },
    { client: mockClient(JSON.stringify(payload)), model: "claude-haiku-4-5-20251001" },
  );
  assert.equal(suggestion.researchQuestion, "¿Por qué falla?");
  // hipótesis vacía (solo espacios) se filtra
  assert.deepEqual(suggestion.hypotheses, ["hipótesis con espacios"]);
  assert.equal(suggestion.productContext, "contexto");
});
