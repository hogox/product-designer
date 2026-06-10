import { test } from "node:test";
import assert from "node:assert/strict";

import { createSpecV0, type Finding, type Spec } from "@pda/spec";

import {
  definitionVerification,
  reviewVerification,
  verifyProposal,
  blockingPasses,
} from "./index.js";

const finding: Finding = {
  id: "F-001",
  statement: "El drop-off en OTP es alto",
  type: "quantitative",
  evidence: [
    {
      source: "funnel.csv",
      locator: "hoja 'csv' (n=315)",
      computation: "drop-off OTP = 43.2% (136/315, n=315)",
    },
  ],
  confidence: "high",
  status: "validated",
  feeds: "outcomes",
  reviewed_by: "Lead",
  review_note: null,
  review_status: "aprobado",
  reviewed_at: null,
};

function proposal(overrides: Partial<Spec> = {}): Spec {
  return {
    ...createSpecV0({ id: "otp", title: "x" }),
    status: "in_review",
    current_stage: "definicion",
    problem_statement: "Los usuarios abandonan en OTP.",
    findings: [finding],
    outcomes: [
      {
        metric: "completitud OTP",
        baseline: "56.8%",
        target: "≥80%",
        method: "GSM",
        heart: "task_success",
        signals: ["completitud"],
      },
    ],
    jtbd: [
      {
        id: "J-001",
        statement:
          "Cuando verifico, quiero confirmar rápido, para no abandonar",
        supported_by: ["F-001"],
      },
    ],
    ...overrides,
  };
}

test("definitionVerification pasa con enmarcado completo y anclado", () => {
  assert.equal(blockingPasses(definitionVerification(proposal())), true);
  assert.equal(blockingPasses(verifyProposal(proposal())), true);
});

test("falla si un JTBD cita un hallazgo inexistente", () => {
  const p = proposal({
    jtbd: [{ id: "J-001", statement: "job", supported_by: ["F-999"] }],
  });
  assert.equal(blockingPasses(definitionVerification(p)), false);
});

test("falla si no hay problem statement", () => {
  const p = proposal({ problem_statement: "" });
  assert.equal(blockingPasses(definitionVerification(p)), false);
});

test("falla si una métrica no declara categoría HEART", () => {
  const p = proposal({
    outcomes: [
      {
        metric: "m",
        baseline: null,
        target: "t",
        method: "HEART",
        heart: null,
        signals: [],
      },
    ],
  });
  assert.equal(blockingPasses(definitionVerification(p)), false);
});

// ---------- W2.3: el gate respeta los estados de revisión ----------

const highWith = (rs: Finding["review_status"]): Finding => ({
  ...finding,
  review_status: rs,
});

test("un hallazgo high pendiente o en_pausa BLOQUEA la compuerta", () => {
  assert.equal(
    blockingPasses(verifyProposal(proposal({ findings: [highWith("pendiente")] }))),
    false,
  );
  assert.equal(
    blockingPasses(verifyProposal(proposal({ findings: [highWith("en_pausa")] }))),
    false,
  );
});

test("un hallazgo high aprobado o rechazado NO bloquea", () => {
  assert.equal(
    blockingPasses(verifyProposal(proposal({ findings: [highWith("aprobado")] }))),
    true,
  );
  assert.equal(
    blockingPasses(verifyProposal(proposal({ findings: [highWith("rechazado")] }))),
    true,
  );
});

test("medium/low en pausa ADVIERTE pero no bloquea", () => {
  const medPaused: Finding = {
    ...finding,
    confidence: "medium",
    review_status: "en_pausa",
  };
  const criteria = reviewVerification([medPaused]);
  // hay una advertencia (no bloqueante) en estado fail
  const warn = criteria.find((c) => !c.blocking);
  assert.ok(warn);
  assert.equal(warn?.status, "fail");
  // pero no bloquea
  assert.equal(blockingPasses(criteria), true);
});
