import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, rm, stat, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  createSpec,
  addSource,
  readSources,
  updateSource,
  discardSource,
  writeManifest,
  inferKind,
  sourceFilePath,
  readAudit,
} from "./index.js";

const execFileAsync = promisify(execFile);

async function tempRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pda-sources-"));
  await execFileAsync("git", ["init", "-q"], { cwd: dir });
  await createSpec(dir, { id: "spec-1", name: "Spec 1", product: "P" }, "Hugo");
  return dir;
}

test("inferKind mapea datos/documento y cae a otro", () => {
  assert.equal(inferKind("text/csv", "funnel.csv"), "datos");
  assert.equal(inferKind("application/octet-stream", "datos.xlsx"), "datos");
  assert.equal(inferKind("application/pdf", "entrevista.pdf"), "documento");
  assert.equal(inferKind("text/plain", "notas.txt"), "documento");
  assert.equal(inferKind("image/png", "captura.png"), "otro");
});

test("addSource computa size+sha256 y persiste el binario con su nombre original", async () => {
  const root = await tempRepo();
  try {
    const bytes = Buffer.from("col_a,col_b\n1,2\n3,4\n", "utf8");
    const entry = await addSource(
      root,
      "spec-1",
      { filename: "funnel.csv", mime: "text/csv", bytes, uploadedBy: "Hugo" },
      "Hugo",
    );
    assert.equal(entry.id, "S-001");
    assert.equal(entry.kind, "datos"); // inferido
    assert.equal(entry.status, "subido");
    assert.equal(entry.size, bytes.length);
    assert.equal(
      entry.sha256,
      createHash("sha256").update(bytes).digest("hex"),
    );

    // el binario existe con su nombre original (preserva extensión para ingestión)
    const fp = sourceFilePath(root, "spec-1", "S-001", "funnel.csv");
    const onDisk = await readFile(fp);
    assert.deepEqual(onDisk, bytes);

    // auditado
    const audit = await readAudit(root, "spec-1");
    assert.equal(audit.at(-1)?.action, "source.upload");
    assert.equal(audit.at(-1)?.target, "S-001");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("addSource asigna ids incrementales S-001, S-002", async () => {
  const root = await tempRepo();
  try {
    const a = await addSource(
      root,
      "spec-1",
      { filename: "a.txt", mime: "text/plain", bytes: Buffer.from("a"), uploadedBy: "Hugo" },
      "Hugo",
    );
    const b = await addSource(
      root,
      "spec-1",
      { filename: "b.txt", mime: "text/plain", bytes: Buffer.from("b"), uploadedBy: "Hugo" },
      "Hugo",
    );
    assert.equal(a.id, "S-001");
    assert.equal(b.id, "S-002");
    const all = await readSources(root, "spec-1");
    assert.equal(all.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("addSource respeta un kind explícito (entrevista no se infiere)", async () => {
  const root = await tempRepo();
  try {
    const entry = await addSource(
      root,
      "spec-1",
      {
        filename: "entrevista_07.pdf",
        mime: "application/pdf",
        bytes: Buffer.from("%PDF-1.4 fake"),
        uploadedBy: "Hugo",
        kind: "entrevista",
      },
      "Hugo",
    );
    assert.equal(entry.kind, "entrevista");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("addSource rechaza archivo vacío", async () => {
  const root = await tempRepo();
  try {
    await assert.rejects(
      () =>
        addSource(
          root,
          "spec-1",
          { filename: "x.txt", mime: "text/plain", bytes: Buffer.alloc(0), uploadedBy: "Hugo" },
          "Hugo",
        ),
      /vacío/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("updateSource edita kind/status/linkedStages y audita", async () => {
  const root = await tempRepo();
  try {
    await addSource(
      root,
      "spec-1",
      { filename: "n.txt", mime: "text/plain", bytes: Buffer.from("n"), uploadedBy: "Hugo" },
      "Hugo",
    );
    const updated = await updateSource(
      root,
      "spec-1",
      "S-001",
      { kind: "entrevista", status: "ingerido", linkedStages: ["descubrimiento"] },
      "Hugo",
    );
    assert.equal(updated.kind, "entrevista");
    assert.equal(updated.status, "ingerido");
    assert.deepEqual(updated.linkedStages, ["descubrimiento"]);
    const audit = await readAudit(root, "spec-1");
    assert.equal(audit.at(-1)?.action, "source.update");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("updateSource falla si la fuente no existe", async () => {
  const root = await tempRepo();
  try {
    await assert.rejects(
      () => updateSource(root, "spec-1", "S-999", { kind: "otro" }, "Hugo"),
      /no encontrada/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("discardSource marca descartado pero conserva el binario + audita", async () => {
  const root = await tempRepo();
  try {
    await addSource(
      root,
      "spec-1",
      { filename: "d.csv", mime: "text/csv", bytes: Buffer.from("a,b\n1,2\n"), uploadedBy: "Hugo" },
      "Hugo",
    );
    const entry = await discardSource(root, "spec-1", "S-001", {
      actor: "Hugo",
      reason: "duplicada",
    });
    assert.equal(entry.status, "descartado");

    // el binario NUNCA se borra
    await stat(sourceFilePath(root, "spec-1", "S-001", "d.csv"));

    const audit = await readAudit(root, "spec-1");
    const last = audit.at(-1);
    assert.equal(last?.action, "source.discard");
    assert.equal(last?.reason, "duplicada");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("readSources devuelve [] si no hay manifest", async () => {
  const root = await tempRepo();
  try {
    assert.deepEqual(await readSources(root, "spec-1"), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writeManifest no persiste un manifest inválido", async () => {
  const root = await tempRepo();
  try {
    await assert.rejects(() =>
      writeManifest(root, "spec-1", [{ id: "S-001" } as never]),
    );
    assert.deepEqual(await readSources(root, "spec-1"), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
