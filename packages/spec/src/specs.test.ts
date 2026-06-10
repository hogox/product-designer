import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, stat, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  createSpec,
  updateSpecMeta,
  archiveSpec,
  readIndex,
  readSpecGroups,
  buildIndex,
  regenerateIndex,
  isValidSpecId,
  slugifySpecId,
  readSpec,
  readAudit,
  specPaths,
  writeSpec,
  createSpecV0,
} from "./index.js";

const execFileAsync = promisify(execFile);

async function tempRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pda-specs-"));
  await execFileAsync("git", ["init", "-q"], { cwd: dir });
  return dir;
}

test("isValidSpecId acepta kebab-case y rechaza el resto", () => {
  assert.ok(isValidSpecId("otp-onboarding"));
  assert.ok(isValidSpecId("a1"));
  assert.ok(!isValidSpecId("OTP"));
  assert.ok(!isValidSpecId("con espacio"));
  assert.ok(!isValidSpecId("-borde"));
  assert.ok(!isValidSpecId("doble--guion"));
  assert.ok(!isValidSpecId(""));
});

test("slugifySpecId deriva kebab-case desde un nombre libre", () => {
  assert.equal(slugifySpecId("OTP Onboarding 2"), "otp-onboarding-2");
  assert.equal(slugifySpecId("  Validación de Pagos  "), "validacion-de-pagos");
});

test("createSpec escribe v0 con metadatos, audita y aparece en el índice", async () => {
  const root = await tempRepo();
  try {
    const entry = await createSpec(
      root,
      { name: "Reducir abandono OTP", product: "Onboarding" },
      "Hugo",
    );
    assert.equal(entry.id, "reducir-abandono-otp"); // id derivado del name
    assert.equal(entry.product, "Onboarding");
    assert.equal(entry.status, "activa");
    assert.equal(entry.stage, "descubrimiento");

    const spec = await readSpec(root, entry.id);
    assert.equal(spec.product, "Onboarding");
    assert.equal(spec.archived, false);
    assert.equal(spec.version, 0);

    const audit = await readAudit(root, entry.id);
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.action, "spec.create");
    assert.equal(audit[0]?.actor, "Hugo");

    const index = await readIndex(root);
    assert.ok(index.some((e) => e.id === entry.id));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createSpec respeta un id explícito y valida kebab-case", async () => {
  const root = await tempRepo();
  try {
    const entry = await createSpec(
      root,
      { id: "otp-onboarding-2", name: "OTP 2", product: "Onboarding" },
      "Hugo",
    );
    assert.equal(entry.id, "otp-onboarding-2");
    await assert.rejects(
      () => createSpec(root, { id: "MAYUS", name: "x", product: "p" }, "Hugo"),
      /id inválido/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createSpec rechaza id duplicado (unicidad contra el filesystem)", async () => {
  const root = await tempRepo();
  try {
    await createSpec(
      root,
      { id: "dup", name: "Uno", product: "P" },
      "Hugo",
    );
    await assert.rejects(
      () => createSpec(root, { id: "dup", name: "Dos", product: "P" }, "Hugo"),
      /ya existe una spec con id "dup"/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("updateSpecMeta edita name/product/description pero el id es inmutable", async () => {
  const root = await tempRepo();
  try {
    const { id } = await createSpec(
      root,
      { id: "spec-x", name: "Nombre viejo", product: "P1" },
      "Hugo",
    );
    const updated = await updateSpecMeta(
      root,
      id,
      { name: "Nombre nuevo", product: "P2", description: "ahora con desc" },
      "Hugo",
    );
    assert.equal(updated.id, "spec-x"); // id intacto
    assert.equal(updated.name, "Nombre nuevo");
    assert.equal(updated.product, "P2");

    const spec = await readSpec(root, id);
    assert.equal(spec.title, "Nombre nuevo");
    assert.equal(spec.description, "ahora con desc");

    const audit = await readAudit(root, id);
    assert.equal(audit.at(-1)?.action, "spec.update");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("archiveSpec es soft delete: archived=true + audit con motivo, el dir sigue existiendo", async () => {
  const root = await tempRepo();
  try {
    const { id } = await createSpec(
      root,
      { id: "a-archivar", name: "Vieja", product: "P" },
      "Hugo",
    );
    const entry = await archiveSpec(root, id, {
      reason: "duplicada de otra iniciativa",
      actor: "Hugo",
    });
    assert.equal(entry.status, "archivada");

    const spec = await readSpec(root, id);
    assert.equal(spec.archived, true);

    // el directorio NUNCA se borra
    await stat(specPaths(root, id).dir);

    const audit = await readAudit(root, id);
    const last = audit.at(-1);
    assert.equal(last?.action, "spec.archive");
    assert.equal(last?.reason, "duplicada de otra iniciativa");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("archiveSpec exige motivo (invariante 7)", async () => {
  const root = await tempRepo();
  try {
    const { id } = await createSpec(
      root,
      { id: "sin-motivo", name: "X", product: "P" },
      "Hugo",
    );
    await assert.rejects(
      () => archiveSpec(root, id, { reason: "  ", actor: "Hugo" }),
      /exige un motivo/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("readIndex regenera el índice si se borra index.yaml (cache regenerable)", async () => {
  const root = await tempRepo();
  try {
    await createSpec(root, { id: "uno", name: "Uno", product: "P" }, "Hugo");
    await createSpec(root, { id: "dos", name: "Dos", product: "P" }, "Hugo");

    const indexFile = join(root, "specs", "index.yaml");
    await stat(indexFile); // existe tras crear
    await unlink(indexFile); // lo borramos

    const regenerated = await readIndex(root); // se reconstruye solo
    await stat(indexFile); // y se vuelve a persistir
    assert.deepEqual(
      regenerated.map((e) => e.id).sort(),
      ["dos", "uno"],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("buildIndex omite directorios sin spec válida (no tumba el listado)", async () => {
  const root = await tempRepo();
  try {
    await createSpec(root, { id: "buena", name: "Buena", product: "P" }, "Hugo");
    // un directorio con un spec.yaml inválido (no pasa el esquema)
    const { mkdir } = await import("node:fs/promises");
    await mkdir(specPaths(root, "rota").dir, { recursive: true });
    await writeFile(specPaths(root, "rota").spec, "{}\n", "utf8");

    const index = await buildIndex(root);
    assert.ok(index.some((e) => e.id === "buena"));
    assert.ok(!index.some((e) => e.id === "rota"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("readSpecGroups agrupa por producto", async () => {
  const root = await tempRepo();
  try {
    await createSpec(root, { id: "ob1", name: "OB Uno", product: "Onboarding" }, "Hugo");
    await createSpec(root, { id: "ob2", name: "OB Dos", product: "Onboarding" }, "Hugo");
    await createSpec(root, { id: "pg1", name: "Pagos Uno", product: "Pagos" }, "Hugo");

    const groups = await readSpecGroups(root);
    assert.equal(groups.length, 2);
    const onboarding = groups.find((g) => g.product === "Onboarding");
    assert.equal(onboarding?.specs.length, 2);
    const pagos = groups.find((g) => g.product === "Pagos");
    assert.equal(pagos?.specs.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("updatedAt del índice deriva del último timestamp de auditoría", async () => {
  const root = await tempRepo();
  try {
    const { id } = await createSpec(
      root,
      { id: "ts", name: "TS", product: "P" },
      "Hugo",
    );
    const index = await regenerateIndex(root);
    const entry = index.find((e) => e.id === id);
    const audit = await readAudit(root, id);
    assert.equal(entry?.updatedAt, audit.at(-1)?.timestamp);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("una spec previa sin product/archived carga por default", async () => {
  const root = await tempRepo();
  try {
    // simula una spec vieja: createSpecV0 ya completa los defaults
    const legacy = createSpecV0({ id: "legacy", title: "Spec previa" });
    await writeSpec(root, legacy);
    const index = await buildIndex(root);
    const entry = index.find((e) => e.id === "legacy");
    assert.equal(entry?.product, "Sin producto");
    assert.equal(entry?.status, "activa");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
