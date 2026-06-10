import { test } from "node:test";
import assert from "node:assert/strict";

import { FindingSchema, type Evidence } from "@pda/spec";

import {
  buildEvidencePool,
  assembleFindings,
  deriveFindings,
  type RawFinding,
  type FindingsProposer,
} from "./index.js";

const quoteEv: Evidence = {
  source: "entrevista-01.txt",
  locator: "párrafo 3",
  quote: "Me cansé de esperar el código y cerré la app",
};
const compEv: Evidence = {
  source: "funnel-otp.csv",
  locator: "hoja 'csv', columnas llego_a_otp+completo_otp (n=315)",
  computation: "drop-off OTP = 43.2% (136/315, n=315)",
};

const pool = buildEvidencePool([quoteEv, compEv]); // E-001 (cita), E-002 (cálculo)

test("buildEvidencePool asigna ids estables", () => {
  assert.equal(pool[0]!.id, "E-001");
  assert.equal(pool[1]!.id, "E-002");
});

test("acepta hallazgo qualitative con cita y quantitative con cálculo", () => {
  const raws: RawFinding[] = [
    {
      statement: "Los usuarios abandonan esperando el código OTP",
      type: "qualitative",
      confidence: "high",
      feeds: "outcomes",
      evidence_ids: ["E-001"],
    },
    {
      statement: "El drop-off en el paso OTP es alto",
      type: "quantitative",
      confidence: "high",
      feeds: "outcomes",
      evidence_ids: ["E-002"],
    },
  ];
  const { accepted, rejected } = assembleFindings(pool, raws);
  assert.equal(accepted.length, 2);
  assert.equal(rejected.length, 0);
  // ids secuenciales y evidencia REAL re-adjuntada desde el pool
  assert.equal(accepted[0]!.id, "F-001");
  assert.equal(accepted[0]!.evidence[0]!.quote, quoteEv.quote);
  assert.equal(accepted[1]!.evidence[0]!.computation, compEv.computation);
  for (const f of accepted)
    assert.equal(FindingSchema.safeParse(f).success, true);
});

test("rechaza quantitative que solo cita una evidencia cualitativa", () => {
  const raws: RawFinding[] = [
    {
      statement: "El 38% abandona (sin cálculo que lo respalde)",
      type: "quantitative",
      confidence: "high",
      feeds: "outcomes",
      evidence_ids: ["E-001"], // solo cita, no cálculo
    },
  ];
  const { accepted, rejected } = assembleFindings(pool, raws);
  assert.equal(accepted.length, 0);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0]!.reason, /computation/);
});

test("rechaza hallazgo sin evidencia válida del pool", () => {
  const raws: RawFinding[] = [
    {
      statement: "afirmación sin fuente",
      type: "qualitative",
      confidence: "low",
      feeds: "hypothesis",
      evidence_ids: ["E-999"], // id inexistente
    },
  ];
  const { accepted, rejected } = assembleFindings(pool, raws);
  assert.equal(accepted.length, 0);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0]!.reason, /sin fuente anclada/);
});

test("deriveFindings usa el proposer (stub) y ensambla", async () => {
  const stub: FindingsProposer = {
    propose: async () => [
      {
        statement: "Hay incertidumbre sobre el envío del código",
        type: "qualitative",
        confidence: "medium",
        feeds: "scope",
        evidence_ids: ["E-001"],
      },
    ],
  };
  const { accepted } = await deriveFindings(pool, {
    topic: "abandono OTP",
    proposer: stub,
  });
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0]!.feeds, "scope");
});

test("deriveFindings pasa el grounding del intake al proposer (W6.2)", async () => {
  const calls: Parameters<FindingsProposer["propose"]>[0][] = [];
  const spy: FindingsProposer = {
    propose: async (input) => {
      calls.push(input);
      return [];
    },
  };
  const grounding = {
    researchQuestion: "¿Por qué se abandona el OTP en onboarding?",
    productContext: "Onboarding bancario regulado",
    hypotheses: ["el SMS tarda", "falta feedback en pantalla"],
  };
  await deriveFindings(pool, { topic: "abandono OTP", proposer: spy, grounding });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.grounding, grounding);
  // la evidencia (pool) llega igual: el grounding orienta, no reemplaza el pool
  assert.equal(calls[0]!.evidence.length, 2);
});

test("sin grounding, el proposer lo recibe undefined (sin regresión)", async () => {
  const calls: Parameters<FindingsProposer["propose"]>[0][] = [];
  const spy: FindingsProposer = {
    propose: async (input) => {
      calls.push(input);
      return [];
    },
  };
  await deriveFindings(pool, { topic: "abandono OTP", proposer: spy });
  assert.equal(calls[0]!.grounding, undefined);
});
