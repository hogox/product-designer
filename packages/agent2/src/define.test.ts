import { test } from "node:test";
import assert from "node:assert/strict";

import { createSpecV0, parseSpec, type Finding } from "@pda/spec";

import {
  assembleDefinition,
  defineProblem,
  type Definer,
  type RawDefinition,
} from "./index.js";

const findings: Finding[] = [
  {
    id: "F-001",
    statement: "El drop-off en OTP es 43.2%",
    type: "quantitative",
    evidence: [
      {
        source: "funnel-otp.csv",
        locator: "hoja 'csv' (n=315)",
        computation: "drop-off OTP = 43.2% (136/315, n=315)",
      },
    ],
    confidence: "high",
    status: "validated",
    feeds: "outcomes",
    reviewed_by: null,
    review_note: null,
  },
  {
    id: "F-002",
    statement: "Abandonan esperando el código",
    type: "qualitative",
    evidence: [
      { source: "e1.txt", locator: "párrafo 3", quote: "me cansé de esperar" },
    ],
    confidence: "high",
    status: "validated",
    feeds: "hypothesis",
    reviewed_by: null,
    review_note: null,
  },
];

const raw: RawDefinition = {
  problem_statement:
    "Los usuarios abandonan el onboarding en el paso de verificación OTP por la latencia del código.",
  jobs: [
    {
      statement:
        "Cuando verifico mi identidad, quiero confirmar el código rápido, para no abandonar el registro",
      supported_by: ["F-001", "F-002"],
    },
    {
      statement: "Job sin sustento (debe rechazarse)",
      supported_by: ["F-999"],
    },
  ],
  outcomes: [
    {
      metric: "tasa de completitud OTP",
      baseline: "56.8% (179/315)",
      target: "≥ 80% (tentativo)",
      method: "Goals-Signals-Metrics",
      heart: "task_success",
      signals: ["completitud OTP", "reintentos por sesión"],
    },
  ],
};

function current() {
  return createSpecV0({ id: "otp", title: "Reducir abandono OTP" });
}

test("assembleDefinition produce JTBD anclado, métricas HEART y rechaza jobs sin sustento", () => {
  const { proposed, rejectedJobs } = assembleDefinition(
    current(),
    findings,
    raw,
  );

  assert.doesNotThrow(() => parseSpec(proposed));
  assert.equal(proposed.status, "in_review");
  assert.equal(proposed.current_stage, "definicion");
  assert.equal(proposed.version, 0); // la versión sube en la compuerta

  // problem statement
  assert.equal(proposed.problem_statement, raw.problem_statement);

  // un solo job válido, con id asignado y procedencia preservada
  assert.equal(proposed.jtbd.length, 1);
  assert.equal(proposed.jtbd[0]!.id, "J-001");
  assert.deepEqual(proposed.jtbd[0]!.supported_by, ["F-001", "F-002"]);

  // el job sin findings reales fue rechazado
  assert.equal(rejectedJobs.length, 1);
  assert.match(rejectedJobs[0]!.reason, /sin procedencia/);

  // outcome enriquecido
  assert.equal(proposed.outcomes[0]!.heart, "task_success");
  assert.equal(proposed.outcomes[0]!.signals?.length, 2);
});

test("filtra ids de findings inexistentes dentro de un job", () => {
  const mixed: RawDefinition = {
    ...raw,
    jobs: [
      {
        statement: "Job con un id válido y otro inválido",
        supported_by: ["F-001", "F-404"],
      },
    ],
  };
  const { proposed } = assembleDefinition(current(), findings, mixed);
  assert.equal(proposed.jtbd.length, 1);
  assert.deepEqual(proposed.jtbd[0]!.supported_by, ["F-001"]); // F-404 se descarta
});

test("defineProblem usa el definer (stub) y ensambla", async () => {
  const stub: Definer = { define: async () => raw };
  const { proposed } = await defineProblem(current(), findings, {
    topic: "abandono OTP",
    definer: stub,
  });
  assert.equal(proposed.jtbd.length, 1);
  assert.equal(proposed.problem_statement, raw.problem_statement);
});
