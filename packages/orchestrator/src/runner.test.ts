// W1.3: resolución de fuentes + marcado `ingerido`. Offline (runner stub), sin tocar la API.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  createSpec,
  addSource,
  readSources,
  sourceFilePath,
  type Finding,
  type Spec,
} from "@pda/spec";

import {
  resolveDiscoverySources,
  runDiscoveryWithSources,
  type DiscoveryRunner,
} from "./index.js";

const execFileAsync = promisify(execFile);
const AUTHOR = { name: "Test", email: "test@example.com" };

async function tempRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pda-runner-"));
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await createSpec(root, { id: "otp", name: "OTP", product: "P" }, "Hugo");
  await execFileAsync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "add", "-A"],
    { cwd: root },
  );
  await execFileAsync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "seed"],
    { cwd: root },
  );
  return root;
}

/** Carpeta de samples de muestra con un par de archivos para el fallback. */
async function makeSamples(root: string): Promise<{
  entrevistasDir: string;
  funnelCsv: string;
}> {
  const entrevistasDir = join(root, "samples", "entrevistas");
  await mkdir(entrevistasDir, { recursive: true });
  await writeFile(join(entrevistasDir, "e1.txt"), "una entrevista", "utf8");
  const funnelCsv = join(root, "samples", "funnel.csv");
  await mkdir(join(root, "samples"), { recursive: true });
  await writeFile(funnelCsv, "a,b\n1,2\n", "utf8");
  return { entrevistasDir, funnelCsv };
}

function findingsStub(): DiscoveryRunner {
  const f: Finding = {
    id: "F-001",
    statement: "Hallazgo de prueba",
    type: "qualitative",
    evidence: [{ source: "e1.txt", locator: "p.1", quote: "cita" }],
    confidence: "high",
    status: "validated",
    feeds: "outcomes",
    reviewed_by: null,
    review_note: null,
    review_status: "pendiente",
    reviewed_at: null,
  };
  return { async run(_c: Spec) { return { findings: [f] }; } };
}

test("resolveDiscoverySources usa las fuentes subidas cuando existen", async () => {
  const root = await tempRepo();
  try {
    const fallback = await makeSamples(root);
    const a = await addSource(
      root,
      "otp",
      { filename: "f.csv", mime: "text/csv", bytes: Buffer.from("a,b\n1,2\n"), uploadedBy: "Hugo" },
      "Hugo",
    );
    const resolved = await resolveDiscoverySources(root, "otp", fallback);
    assert.equal(resolved.fromSamples, false);
    assert.deepEqual(resolved.sourceIds, [a.id]);
    assert.deepEqual(resolved.files, [
      sourceFilePath(root, "otp", a.id, "f.csv"),
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resolveDiscoverySources cae a samples cuando no hay fuentes subidas", async () => {
  const root = await tempRepo();
  try {
    const fallback = await makeSamples(root);
    const resolved = await resolveDiscoverySources(root, "otp", fallback);
    assert.equal(resolved.fromSamples, true);
    assert.deepEqual(resolved.sourceIds, []);
    assert.ok(resolved.files.some((f) => f.endsWith("e1.txt")));
    assert.ok(resolved.files.some((f) => f.endsWith("funnel.csv")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resolveDiscoverySources ignora fuentes descartadas", async () => {
  const root = await tempRepo();
  try {
    const fallback = await makeSamples(root);
    await addSource(
      root,
      "otp",
      { filename: "x.csv", mime: "text/csv", bytes: Buffer.from("a\n1\n"), uploadedBy: "Hugo" },
      "Hugo",
    );
    // descartar la única fuente → debe caer a samples
    const { discardSource } = await import("@pda/spec");
    await discardSource(root, "otp", "S-001", { actor: "Hugo" });
    const resolved = await resolveDiscoverySources(root, "otp", fallback);
    assert.equal(resolved.fromSamples, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runDiscoveryWithSources marca ingerido las fuentes usadas (runner stub)", async () => {
  const root = await tempRepo();
  try {
    const fallback = await makeSamples(root);
    await addSource(
      root,
      "otp",
      { filename: "f.csv", mime: "text/csv", bytes: Buffer.from("a,b\n1,2\n"), uploadedBy: "Hugo" },
      "Hugo",
    );
    const r = await runDiscoveryWithSources(root, "otp", {
      topic: "t",
      fallback,
      author: AUTHOR,
      makeRunner: () => findingsStub(),
    });
    assert.equal(r.fromSamples, false);
    assert.equal(r.findings.length, 1);
    const sources = await readSources(root, "otp");
    assert.equal(sources[0]?.status, "ingerido");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runDiscoveryWithSources con samples NO toca el manifest", async () => {
  const root = await tempRepo();
  try {
    const fallback = await makeSamples(root);
    const r = await runDiscoveryWithSources(root, "otp", {
      topic: "t",
      fallback,
      author: AUTHOR,
      makeRunner: () => findingsStub(),
    });
    assert.equal(r.fromSamples, true);
    assert.deepEqual(await readSources(root, "otp"), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
