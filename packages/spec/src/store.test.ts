import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  createSpecV0,
  writeSpec,
  readSpec,
  commitSpec,
  appendAudit,
  readAudit,
  specPaths,
  writeProposedSpec,
  readProposedSpec,
  writeFindings,
  readFindings,
  type Finding,
} from "./index.js";

const execFileAsync = promisify(execFile);
const AUTHOR = { name: "Test", email: "test@example.com" };

async function tempRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pda-spec-"));
  await execFileAsync("git", ["init", "-q"], { cwd: dir });
  return dir;
}

test("escribe, commitea, relee una spec v0 y registra auditoría", async () => {
  const root = await tempRepo();
  try {
    const spec = createSpecV0({
      id: "spec-001",
      title: "Spec inicial de prueba",
    });

    // escribir + leer (round-trip por YAML, revalidado contra el esquema)
    await writeSpec(root, spec);
    const roundTrip = await readSpec(root, "spec-001");
    assert.deepEqual(roundTrip, spec);

    // auditar la creación (quién/qué/cuándo)
    await appendAudit(root, {
      actor: "human",
      action: "spec.create",
      spec_id: "spec-001",
    });

    // commitear el directorio de la spec
    await commitSpec(root, "spec-001", "crea spec v0", AUTHOR);

    // el commit existe y toca el spec.yaml
    const { stdout } = await execFileAsync("git", ["log", "--oneline"], {
      cwd: root,
    });
    assert.match(stdout, /crea spec v0/);

    // la auditoría quedó persistida con una entrada
    const entries = await readAudit(root, "spec-001");
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.action, "spec.create");
    assert.equal(entries[0]?.actor, "human");
    assert.ok(entries[0]?.timestamp);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("registra el motivo al rechazar un hallazgo (invariante 7)", async () => {
  const root = await tempRepo();
  try {
    await appendAudit(root, {
      actor: "human",
      action: "finding.reject",
      spec_id: "spec-001",
      target: "F-003",
      reason: "la cita no respalda la afirmación",
    });
    const entries = await readAudit(root, "spec-001");
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.target, "F-003");
    assert.equal(entries[0]?.reason, "la cita no respalda la afirmación");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("no escribe una spec inválida", async () => {
  const root = await tempRepo();
  try {
    const bad = { ...createSpecV0({ id: "x", title: "x" }), version: -1 };
    await assert.rejects(() => writeSpec(root, bad as never));
    // y no se creó el archivo
    await assert.rejects(() => stat(specPaths(root, "x").spec));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("readAudit devuelve [] si no hay log", async () => {
  const root = await tempRepo();
  try {
    assert.deepEqual(await readAudit(root, "inexistente"), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

const sampleFinding: Finding = {
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
  status: "validated",
  feeds: "outcomes",
  reviewed_by: "human",
  review_note: null,
  review_status: "pendiente",
  reviewed_at: null,
};

test("round-trip de spec.proposed.yaml", async () => {
  const root = await tempRepo();
  try {
    const proposed = {
      ...createSpecV0({ id: "otp", title: "Reducir abandono OTP" }),
      status: "in_review" as const,
      problem_statement: "Los usuarios abandonan en el paso OTP.",
    };
    await writeProposedSpec(root, proposed);
    assert.deepEqual(await readProposedSpec(root, "otp"), proposed);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("round-trip de findings.yaml (validados)", async () => {
  const root = await tempRepo();
  try {
    await writeFindings(root, "otp", [sampleFinding]);
    const back = await readFindings(root, "otp");
    assert.equal(back.length, 1);
    assert.deepEqual(back[0], sampleFinding);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("readFindings devuelve [] si no hay archivo", async () => {
  const root = await tempRepo();
  try {
    assert.deepEqual(await readFindings(root, "inexistente"), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
