import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { EvidenceSchema } from "@pda/spec";

import {
  ingestText,
  verifyCandidates,
  extractTextEvidence,
  type EvidenceProposer,
  type RawEvidenceCandidate,
} from "./index.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const ENTREVISTA = join(REPO, "samples", "entrevistas", "entrevista-01.txt");

// proposer stub: devuelve candidatos predefinidos (sin red)
function stubProposer(candidates: RawEvidenceCandidate[]): EvidenceProposer {
  return { propose: async () => candidates };
}

test("acepta citas reales y deriva su locator real", async () => {
  const doc = await ingestText(ENTREVISTA);
  const result = verifyCandidates(doc, [
    // cita real (con locator inventado por el "modelo": debe corregirse al real)
    {
      quote: "Me cansé de esperar el código y cerré la app",
      locator: "párrafo 999",
    },
  ]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 0);
  // el locator se derivó de dónde aparece de verdad, no del que afirmó el modelo
  assert.notEqual(result.accepted[0]!.locator, "párrafo 999");
  assert.match(result.accepted[0]!.locator, /^párrafo \d+$/);
  // y es evidencia cualitativa válida
  assert.equal(EvidenceSchema.safeParse(result.accepted[0]).success, true);
});

test("rechaza una cita alucinada (no existe en la fuente)", async () => {
  const doc = await ingestText(ENTREVISTA);
  const result = verifyCandidates(doc, [
    { quote: "la biometría falló tres veces seguidas", locator: "párrafo 2" },
  ]);
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.match(result.rejected[0]!.reason, /no existe textualmente/);
});

test("tolera diferencias de espacios en blanco al verificar", async () => {
  const doc = await ingestText(ENTREVISTA);
  const result = verifyCandidates(doc, [
    { quote: "Me cansé   de esperar el código\n y cerré la app", locator: "x" },
  ]);
  assert.equal(result.accepted.length, 1);
});

test("deduplica citas equivalentes", async () => {
  const doc = await ingestText(ENTREVISTA);
  const q = "Me cansé de esperar el código y cerré la app";
  const result = verifyCandidates(doc, [
    { quote: q, locator: "a" },
    { quote: q, locator: "b" },
  ]);
  assert.equal(result.accepted.length, 1);
});

test("extractTextEvidence: propone (stub) → verifica (separa real de alucinado)", async () => {
  const doc = await ingestText(ENTREVISTA);
  const proposer = stubProposer([
    { quote: "El SMS con el código siempre demora", locator: "?" }, // no está en entrevista-01
    { quote: "No sabía si el código había sido enviado o no", locator: "?" }, // sí está
    { quote: "inventado que no aparece", locator: "?" },
  ]);
  const result = await extractTextEvidence(doc, {
    topic: "abandono en la verificación OTP del onboarding",
    proposer,
  });
  assert.equal(result.accepted.length, 1);
  assert.equal(
    result.accepted[0]!.quote,
    "No sabía si el código había sido enviado o no",
  );
  assert.equal(result.rejected.length, 2);
});
