import { test } from "node:test";
import assert from "node:assert/strict";

import { createSpecV0, parseSpec, type Finding } from "@pda/spec";

import {
  assembleProposal,
  synthesizeProposal,
  type SynthesisDraft,
  type Synthesizer,
} from "./index.js";

const findings: Finding[] = [
  {
    id: "F-001",
    statement: "El drop-off en OTP es alto",
    type: "quantitative",
    evidence: [
      {
        source: "funnel-otp.csv",
        locator: "hoja 'csv' (n=315)",
        computation: "drop-off OTP = 43.2% (136/315, n=315)",
      },
    ],
    confidence: "high",
    status: "proposed",
    feeds: "outcomes",
    reviewed_by: null,
    review_note: null,
  },
  {
    id: "F-002",
    statement: "Los usuarios abandonan esperando el código",
    type: "qualitative",
    evidence: [
      {
        source: "entrevista-01.txt",
        locator: "párrafo 3",
        quote: "Me cansé de esperar el código y cerré la app",
      },
    ],
    confidence: "high",
    status: "proposed",
    feeds: "outcomes",
    reviewed_by: null,
    review_note: null,
  },
];

const draft: SynthesisDraft = {
  problem_statement:
    "Los usuarios abandonan el onboarding en el paso de verificación OTP por la latencia del código y la falta de feedback.",
  outcomes: [
    {
      metric: "tasa de completitud OTP",
      baseline: "56.8% (1 - 43.2% drop-off, n=315)",
      target: "≥ 80%",
      method: "Goals-Signals-Metrics",
    },
  ],
  in_scope: ["paso de verificación OTP del onboarding"],
  non_goals: ["rediseño integral del login"],
  hypotheses: [
    "Mostrar un contador y el número enmascarado reduce el abandono",
    "Acelerar la entrega del SMS reduce el abandono",
  ],
};

test("assembleProposal arma una propuesta válida y promueve hallazgos", () => {
  const current = createSpecV0({ id: "otp", title: "Reducir abandono OTP" });
  const proposed = assembleProposal(current, findings, draft);

  assert.doesNotThrow(() => parseSpec(proposed));
  assert.equal(proposed.status, "in_review");
  assert.equal(proposed.version, 0); // la versión sube solo en la compuerta
  assert.equal(proposed.problem_statement, draft.problem_statement);
  assert.equal(proposed.outcomes.length, 1);
  // hallazgos promovidos y marcados validated
  assert.equal(proposed.findings.length, 2);
  assert.ok(proposed.findings.every((f) => f.status === "validated"));
  // hipótesis → tareas de definición
  const hyps = proposed.tasks.filter((t) => t.id.startsWith("H-"));
  assert.equal(hyps.length, 2);
  assert.equal(hyps[0]!.stage, "definicion");
  assert.equal(hyps[0]!.owner, "human");
});

test("assembleProposal rechaza un outcome inválido (target vacío)", () => {
  const current = createSpecV0({ id: "otp", title: "x" });
  const badDraft: SynthesisDraft = {
    ...draft,
    outcomes: [{ metric: "m", baseline: null, target: "", method: "HEART" }],
  };
  assert.throws(() => assembleProposal(current, findings, badDraft));
});

test("synthesizeProposal usa el synthesizer (stub) y ensambla", async () => {
  const current = createSpecV0({ id: "otp", title: "Reducir abandono OTP" });
  const stub: Synthesizer = { synthesize: async () => draft };
  const proposed = await synthesizeProposal(current, findings, {
    topic: "abandono OTP",
    synthesizer: stub,
  });
  assert.equal(proposed.problem_statement, draft.problem_statement);
  assert.equal(proposed.findings.length, 2);
});
