import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  createSpec,
  addSource,
  discardSource,
  readSpec,
  readAudit,
  updateIntake,
  computeSourceCompleteness,
} from "./index.js";

const execFileAsync = promisify(execFile);

async function tempRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pda-intake-"));
  await execFileAsync("git", ["init", "-q"], { cwd: dir });
  await createSpec(dir, { id: "spec-1", name: "Spec 1", product: "P" }, "Hugo");
  return dir;
}

test("updateIntake persiste el intake, deriva expectedSourceKinds y audita", async () => {
  const root = await tempRepo();
  const next = await updateIntake(
    root,
    "spec-1",
    {
      researchQuestion: "¿Por qué se abandona el OTP?",
      hypotheses: ["el SMS tarda"],
      discoveryPlan: { methods: ["entrevistas", "analitica"] }, // sin expectedSourceKinds
    },
    "Hugo (Lead PM)",
  );

  // derivó los tipos esperados del mapa determinista (métodos → tipos)
  assert.deepEqual(next.intake?.discoveryPlan.expectedSourceKinds, [
    "entrevista",
    "datos",
  ]);

  // persistido en disco
  const onDisk = await readSpec(root, "spec-1");
  assert.equal(
    onDisk.intake?.researchQuestion,
    "¿Por qué se abandona el OTP?",
  );

  // auditado intake.update con el actor de sesión
  const audit = await readAudit(root, "spec-1");
  const entry = audit.find((a) => a.action === "intake.update");
  assert.ok(entry, "hay entrada intake.update");
  assert.equal(entry!.actor, "Hugo (Lead PM)");
});

test("updateIntake respeta expectedSourceKinds explícitos (editable)", async () => {
  const root = await tempRepo();
  const next = await updateIntake(
    root,
    "spec-1",
    {
      researchQuestion: "q",
      discoveryPlan: {
        methods: ["entrevistas"],
        expectedSourceKinds: ["persona", "documento"], // override explícito
      },
    },
    "Hugo",
  );
  assert.deepEqual(next.intake?.discoveryPlan.expectedSourceKinds, [
    "persona",
    "documento",
  ]);
});

test("updateIntake rechaza intake sin researchQuestion", async () => {
  const root = await tempRepo();
  await assert.rejects(() =>
    updateIntake(root, "spec-1", { researchQuestion: "" }, "Hugo"),
  );
});

test("completitud: faltan los tipos esperados no subidos", async () => {
  const root = await tempRepo();
  await updateIntake(
    root,
    "spec-1",
    { researchQuestion: "q", discoveryPlan: { methods: ["entrevistas", "analitica"] } },
    "Hugo",
  ); // espera entrevista + datos

  // sin fuentes → faltan ambos
  let c = await computeSourceCompleteness(root, "spec-1");
  assert.deepEqual(c.expected.sort(), ["datos", "entrevista"]);
  assert.deepEqual(c.missing.sort(), ["datos", "entrevista"]);
  assert.equal(c.satisfied, false);

  // subo una fuente de datos (kind explícito) → falta solo entrevista
  await addSource(
    root,
    "spec-1",
    {
      filename: "funnel.csv",
      mime: "text/csv",
      bytes: Buffer.from("a,b\n1,2\n"),
      uploadedBy: "Hugo",
      kind: "datos",
    },
    "Hugo",
  );
  c = await computeSourceCompleteness(root, "spec-1");
  assert.deepEqual(c.present, ["datos"]);
  assert.deepEqual(c.missing, ["entrevista"]);
  assert.equal(c.satisfied, false);
});

test("completitud: una fuente descartada no cuenta como presente", async () => {
  const root = await tempRepo();
  await updateIntake(
    root,
    "spec-1",
    { researchQuestion: "q", discoveryPlan: { methods: ["analitica"] } },
    "Hugo",
  );
  const s = await addSource(
    root,
    "spec-1",
    {
      filename: "f.csv",
      mime: "text/csv",
      bytes: Buffer.from("a\n1\n"),
      uploadedBy: "Hugo",
      kind: "datos",
    },
    "Hugo",
  );
  await discardSource(root, "spec-1", s.id, { actor: "Hugo" });
  const c = await computeSourceCompleteness(root, "spec-1");
  assert.deepEqual(c.present, []);
  assert.deepEqual(c.missing, ["datos"]);
});

test("completitud sin intake: satisfied (no hay tipos exigidos)", async () => {
  const root = await tempRepo();
  const c = await computeSourceCompleteness(root, "spec-1");
  assert.deepEqual(c.expected, []);
  assert.deepEqual(c.missing, []);
  assert.equal(c.satisfied, true);
});
