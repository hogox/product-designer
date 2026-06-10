import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SpecSchema,
  FindingSchema,
  EvidenceSchema,
  createSpecV0,
  parseSpec,
  safeParseSpec,
  type Spec,
  type Finding,
} from "./index.js";

// ---------- fixtures ----------

const qualitativeFinding: Finding = {
  id: "F-001",
  statement: "Los usuarios abandonan en el paso de verificación OTP",
  type: "qualitative",
  evidence: [
    {
      source: "entrevista_07.pdf",
      locator: "p.3, párrafo 2",
      quote: "me cansé de esperar el código y cerré la app",
    },
  ],
  confidence: "high",
  status: "proposed",
  feeds: "outcomes",
  reviewed_by: null,
  review_note: null,
  review_status: "pendiente",
  reviewed_at: null,
};

const quantitativeFinding: Finding = {
  id: "F-002",
  statement: "El drop-off en OTP es alto",
  type: "quantitative",
  evidence: [
    {
      source: "abandono.csv",
      locator: "hoja 'funnel', filas 40-128",
      computation: "drop-off OTP = 38% (n=312)",
    },
  ],
  confidence: "medium",
  status: "proposed",
  feeds: "outcomes",
  reviewed_by: null,
  review_note: null,
  review_status: "pendiente",
  reviewed_at: null,
};

function fullValidSpec(): Spec {
  return {
    id: "spec-demo",
    title: "Reducir abandono en verificación OTP",
    product: "Onboarding",
    description: null,
    archived: false,
    version: 1,
    status: "in_review",
    current_stage: "descubrimiento",
    problem_statement: "Los usuarios abandonan en el paso de verificación OTP.",
    outcomes: [
      {
        metric: "tasa de completitud OTP",
        baseline: "62%",
        target: "80%",
        method: "Goals-Signals-Metrics",
      },
    ],
    scope: {
      in_scope: ["flujo OTP"],
      non_goals: ["rediseño del login completo"],
    },
    constraints: {
      regulatory: ["CMF"],
      accessibility: "WCAG 2.2 AA",
      design_system: {
        name: "DS Banco",
        version: "3.1",
        link: "https://ds.example",
      },
      technical: ["SMS gateway legacy"],
    },
    decisions: [
      {
        id: "D-001",
        date: "2026-06-09",
        decision: "Enfocar el slice en el paso OTP",
        rationale: "Es donde se concentra el abandono",
        author: "human",
        supersedes: null,
      },
    ],
    tasks: [
      {
        id: "T-001",
        description: "Sintetizar research de abandono",
        stage: "descubrimiento",
        owner: "agent",
        status: "in_progress",
      },
    ],
    verification: [
      {
        criterion: "Todo hallazgo tiene evidencia anclada",
        type: "automated",
        blocking: true,
        status: "pending",
        evidence: null,
      },
    ],
    findings: [qualitativeFinding, quantitativeFinding],
    jtbd: [
      {
        id: "J-001",
        statement:
          "Cuando verifico mi identidad en el onboarding, quiero recibir y confirmar el código rápido, para no abandonar el registro",
        supported_by: ["F-001", "F-002"],
      },
    ],
    history: [
      {
        version: 1,
        stage: "descubrimiento",
        proposed_by: "agent1",
        change_summary: "Promovidos 2 hallazgos validados",
        approved_by: "human",
        timestamp: "2026-06-09T12:00:00.000Z",
      },
    ],
  };
}

// ---------- specs válidas ----------

test("createSpecV0 produce una spec v0 válida", () => {
  const spec = createSpecV0({ id: "spec-001", title: "Mi spec inicial" });
  assert.doesNotThrow(() => parseSpec(spec));
  assert.equal(spec.version, 0);
  assert.equal(spec.status, "draft");
  assert.equal(spec.current_stage, "descubrimiento");
});

test("createSpecV0 acepta product/description y por default los completa (compat)", () => {
  const conMeta = createSpecV0({
    id: "spec-002",
    title: "Con producto",
    product: "Onboarding",
    description: "una descripción",
  });
  assert.equal(conMeta.product, "Onboarding");
  assert.equal(conMeta.description, "una descripción");
  assert.equal(conMeta.archived, false);

  const sinMeta = createSpecV0({ id: "spec-003", title: "Sin producto" });
  assert.equal(sinMeta.product, "Sin producto");
  assert.equal(sinMeta.description, null);
});

test("SpecSchema aplica defaults de product/description/archived a una spec previa", () => {
  // simula una spec serializada antes de D2 (sin los campos nuevos)
  const legacy = { ...fullValidSpec() } as Record<string, unknown>;
  delete legacy.product;
  delete legacy.description;
  delete legacy.archived;
  const res = safeParseSpec(legacy);
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.data.product, "Sin producto");
    assert.equal(res.data.description, null);
    assert.equal(res.data.archived, false);
  }
});

test("una spec completa y bien formada valida", () => {
  const res = safeParseSpec(fullValidSpec());
  assert.equal(res.success, true);
});

// ---------- specs inválidas ----------

test("rechaza status fuera del enum", () => {
  const bad = { ...fullValidSpec(), status: "publicada" };
  assert.equal(safeParseSpec(bad).success, false);
});

test("rechaza version negativa o no entera", () => {
  assert.equal(
    safeParseSpec({ ...fullValidSpec(), version: -1 }).success,
    false,
  );
  assert.equal(
    safeParseSpec({ ...fullValidSpec(), version: 1.5 }).success,
    false,
  );
});

test("rechaza current_stage desconocida", () => {
  const bad = { ...fullValidSpec(), current_stage: "entregable" };
  assert.equal(safeParseSpec(bad).success, false);
});

// ---------- reglas del objeto finding (invariantes 3 y 5) ----------

test("rechaza un hallazgo sin evidencia (invariante 5)", () => {
  const res = FindingSchema.safeParse({ ...qualitativeFinding, evidence: [] });
  assert.equal(res.success, false);
});

test("rechaza un hallazgo quantitative sin computation", () => {
  const res = FindingSchema.safeParse({
    ...quantitativeFinding,
    evidence: [
      {
        source: "x.csv",
        locator: "filas 1-10",
        quote: "una cita pero no un cálculo",
      },
    ],
  });
  assert.equal(res.success, false);
});

test("rechaza un hallazgo qualitative sin quote textual", () => {
  const res = FindingSchema.safeParse({
    ...qualitativeFinding,
    evidence: [{ source: "x.csv", locator: "filas 1-10", computation: "38%" }],
  });
  assert.equal(res.success, false);
});

test("rechaza evidence sin quote ni computation", () => {
  const res = EvidenceSchema.safeParse({ source: "x.pdf", locator: "p.1" });
  assert.equal(res.success, false);
});

test("acepta finding qualitative con quote y quantitative con computation", () => {
  assert.equal(FindingSchema.safeParse(qualitativeFinding).success, true);
  assert.equal(FindingSchema.safeParse(quantitativeFinding).success, true);
});

// ---------- Definición (Fase 2): JTBD + métricas estructuradas ----------

test("createSpecV0 incluye jtbd vacío", () => {
  const spec = createSpecV0({ id: "x", title: "x" });
  assert.deepEqual(spec.jtbd, []);
});

test("rechaza un job JTBD sin supported_by (procedencia)", () => {
  const bad = {
    ...fullValidSpec(),
    jtbd: [{ id: "J-001", statement: "un job", supported_by: [] }],
  };
  assert.equal(safeParseSpec(bad).success, false);
});

test("acepta outcome enriquecido con categoría HEART y señales", () => {
  const spec = fullValidSpec();
  spec.outcomes[0]!.heart = "task_success";
  spec.outcomes[0]!.signals = [
    "tasa de completitud OTP",
    "reintentos por sesión",
  ];
  assert.equal(safeParseSpec(spec).success, true);
});

test("rechaza categoría HEART inválida", () => {
  const spec = fullValidSpec();
  // @ts-expect-error categoría fuera del enum
  spec.outcomes[0]!.heart = "felicidad";
  assert.equal(safeParseSpec(spec).success, false);
});
