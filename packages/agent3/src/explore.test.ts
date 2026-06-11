import { test } from "node:test";
import assert from "node:assert/strict";

import type { Job } from "@pda/spec";

import {
  assembleConcepts,
  exploreConceptsFromJobs,
  type ConceptProposer,
  type RawConcept,
} from "./index.js";

const jobs: Job[] = [
  {
    id: "J-001",
    statement: "Cuando verifico mi identidad, quiero confirmar el código rápido",
    supported_by: ["F-001"],
  },
  {
    id: "J-002",
    statement: "Cuando falla el envío, quiero entender por qué",
    supported_by: ["F-002"],
  },
];

const rawValid: RawConcept = {
  title: "Reenvío con retroalimentación",
  description: "Botón de reenvío con contador y mensaje de estado claro.",
  rationale: "Reduce la incertidumbre del usuario al saber cuándo esperar.",
  addresses_jtbd: ["J-001", "J-002"],
};

const rawInvalidJtbd: RawConcept = {
  title: "Concepto fantasma",
  description: "Un concepto que cita jobs inexistentes.",
  rationale: "No hay sustento real.",
  addresses_jtbd: ["J-999"],
};

// ─── assembleConcepts ──────────────────────────────────────────────────────────

test("assembleConcepts acepta conceptos con JTBD válidos y asigna C-00N", () => {
  const { accepted, rejected } = assembleConcepts(jobs, [rawValid]);

  assert.equal(accepted.length, 1);
  assert.equal(rejected.length, 0);
  assert.equal(accepted[0]!.id, "C-001");
  assert.equal(accepted[0]!.title, rawValid.title);
  assert.equal(accepted[0]!.review_status, "propuesto");
  assert.deepEqual(accepted[0]!.addresses_jtbd, ["J-001", "J-002"]);
});

test("assembleConcepts rechaza conceptos que citan solo JTBD inexistentes", () => {
  const { accepted, rejected } = assembleConcepts(jobs, [rawInvalidJtbd]);

  assert.equal(accepted.length, 0);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0]!.reason, /sin procedencia JTBD/);
});

test("assembleConcepts filtra ids de JTBD inválidos dentro de un concepto válido", () => {
  const mixed: RawConcept = {
    ...rawValid,
    addresses_jtbd: ["J-001", "J-404"], // J-404 no existe
  };
  const { accepted } = assembleConcepts(jobs, [mixed]);

  assert.equal(accepted.length, 1);
  assert.deepEqual(accepted[0]!.addresses_jtbd, ["J-001"]); // J-404 descartado
});

test("assembleConcepts asigna ids consecutivos a los aceptados", () => {
  const { accepted } = assembleConcepts(jobs, [rawValid, rawValid, rawValid]);

  assert.equal(accepted.length, 3);
  assert.equal(accepted[0]!.id, "C-001");
  assert.equal(accepted[1]!.id, "C-002");
  assert.equal(accepted[2]!.id, "C-003");
});

test("assembleConcepts arranca los ids en firstId (re-explore no recicla, P3)", () => {
  const { accepted } = assembleConcepts(jobs, [rawValid, rawValid], {
    firstId: 4,
  });

  assert.equal(accepted.length, 2);
  assert.equal(accepted[0]!.id, "C-004");
  assert.equal(accepted[1]!.id, "C-005");
});

test("assembleConcepts mezcla: aceptados y rechazados en el mismo lote", () => {
  const { accepted, rejected } = assembleConcepts(jobs, [
    rawValid,
    rawInvalidJtbd,
    rawValid,
  ]);

  assert.equal(accepted.length, 2);
  assert.equal(rejected.length, 1);
  assert.equal(accepted[0]!.id, "C-001");
  assert.equal(accepted[1]!.id, "C-002");
});

// ─── exploreConceptsFromJobs ───────────────────────────────────────────────────

test("exploreConceptsFromJobs usa el proposer (stub) y ensambla", async () => {
  const stub: ConceptProposer = {
    propose: async () => [rawValid],
  };

  const { accepted, rejected } = await exploreConceptsFromJobs(jobs, {
    topic: "abandono OTP",
    problemStatement: "Los usuarios abandonan en el paso de verificación OTP.",
    proposer: stub,
  });

  assert.equal(accepted.length, 1);
  assert.equal(rejected.length, 0);
  assert.equal(accepted[0]!.title, rawValid.title);
});

test("exploreConceptsFromJobs con feedback de descartados — se pasa al proposer", async () => {
  let capturedFeedback: string | undefined;
  const stub: ConceptProposer = {
    propose: async ({ discardedFeedback }) => {
      capturedFeedback = discardedFeedback;
      return [rawValid];
    },
  };

  await exploreConceptsFromJobs(jobs, {
    topic: "abandono OTP",
    problemStatement: "PS",
    proposer: stub,
    discardedFeedback: "[C-001] Concepto previo: muy complejo",
  });

  assert.equal(capturedFeedback, "[C-001] Concepto previo: muy complejo");
});

test("exploreConceptsFromJobs pasa el contexto de producto al proposer (P5)", async () => {
  let captured: unknown;
  const stub: ConceptProposer = {
    propose: async ({ context }) => {
      captured = context;
      return [rawValid];
    },
  };

  await exploreConceptsFromJobs(jobs, {
    topic: "abandono OTP",
    problemStatement: "PS",
    proposer: stub,
    context: {
      productContext: "App de banca móvil",
      constraints: ["WCAG 2.2 AA"],
      nonGoals: ["No rediseñar el login"],
    },
  });

  assert.deepEqual(captured, {
    productContext: "App de banca móvil",
    constraints: ["WCAG 2.2 AA"],
    nonGoals: ["No rediseñar el login"],
  });
});
