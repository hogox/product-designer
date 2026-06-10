// Gestión multi-spec (Fase D2 · W0): índice ligero + CRUD con auditoría.
//
// El índice (`specs/index.yaml`) es CACHE regenerable: la verdad es el filesystem
// (`specs/<id>/spec.yaml`). Si el índice se borra o se desincroniza, se reconstruye
// escaneando los directorios. Por eso toda mutación (crear/editar/archivar) regenera
// el índice desde la verdad en vez de parchearlo a mano.
//
// Invariantes que materializa:
//  - el `id` es inmutable (ruta en git + clave de auditoría); solo se editan
//    name/product/description.
//  - archivar = soft delete (`archived: true` + entrada de auditoría); NUNCA se borra
//    el directorio de la spec.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";

import { appendAudit, readAudit } from "./audit.js";
import { createSpecV0, StageSchema, safeParseSpec } from "./schema.js";
import { readSpec, specPaths, writeSpec } from "./store.js";

// ---------- esquema del índice ----------

export const SpecIndexStatusSchema = z.enum(["activa", "archivada"]);
export type SpecIndexStatus = z.infer<typeof SpecIndexStatusSchema>;

export const SpecIndexEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1), // = spec.title
  product: z.string().min(1), // agrupador
  stage: StageSchema, // = spec.current_stage
  status: SpecIndexStatusSchema, // derivado de spec.archived
  updatedAt: z.string().nullable(), // último timestamp de auditoría (fallback: history)
});
export type SpecIndexEntry = z.infer<typeof SpecIndexEntrySchema>;

export const SpecIndexSchema = z.array(SpecIndexEntrySchema);
export type SpecIndex = z.infer<typeof SpecIndexSchema>;

/** Grupo de specs bajo un mismo producto (forma que consume la API/UI). */
export interface SpecGroup {
  product: string;
  specs: SpecIndexEntry[];
}

const INDEX_FILE = "index.yaml";

function indexPath(rootDir: string): string {
  return join(rootDir, "specs", INDEX_FILE);
}

// ---------- validación de id ----------

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** kebab-case estricto: minúsculas, dígitos y guiones simples (sin guiones al borde). */
export function isValidSpecId(id: string): boolean {
  return KEBAB.test(id);
}

/** Deriva un id kebab-case desde un nombre libre (slug). */
export function slugifySpecId(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos (marcas combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------- construcción del índice (desde la verdad: el filesystem) ----------

/** Último timestamp conocido de la spec: última entrada de auditoría; si no hay, último history. */
async function deriveUpdatedAt(
  rootDir: string,
  id: string,
  history: { timestamp: string }[],
): Promise<string | null> {
  const audit = await readAudit(rootDir, id);
  if (audit.length > 0) return audit[audit.length - 1]!.timestamp;
  if (history.length > 0) return history[history.length - 1]!.timestamp;
  return null;
}

/**
 * Reconstruye el índice escaneando `specs/<id>/spec.yaml`. Salta directorios sin una
 * spec válida (no debe tumbar el listado por una spec corrupta o a medio crear).
 */
export async function buildIndex(rootDir: string): Promise<SpecIndex> {
  const specsDir = join(rootDir, "specs");
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(specsDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const out: SpecIndexEntry[] = [];
  for (const dirent of entries) {
    if (!dirent.isDirectory()) continue;
    const id = dirent.name;
    let raw: string;
    try {
      raw = await readFile(specPaths(rootDir, id).spec, "utf8");
    } catch {
      continue; // sin spec.yaml legible → no es una spec
    }
    const parsed = safeParseSpec(parseYaml(raw));
    if (!parsed.success) continue; // spec inválida → se omite del índice
    const spec = parsed.data;
    out.push({
      id: spec.id,
      name: spec.title,
      product: spec.product,
      stage: spec.current_stage,
      status: spec.archived ? "archivada" : "activa",
      updatedAt: await deriveUpdatedAt(rootDir, spec.id, spec.history),
    });
  }
  // orden estable: producto, luego nombre (no dependemos del orden del filesystem)
  out.sort(
    (a, b) => a.product.localeCompare(b.product) || a.name.localeCompare(b.name),
  );
  return SpecIndexSchema.parse(out);
}

/** Persiste el índice (validado) en `specs/index.yaml`. */
export async function writeIndex(
  rootDir: string,
  index: SpecIndex,
): Promise<string> {
  const valid = SpecIndexSchema.parse(index);
  const file = indexPath(rootDir);
  await writeFile(file, stringifyYaml(valid), "utf8");
  return file;
}

/** Regenera el índice desde el filesystem y lo persiste. */
export async function regenerateIndex(rootDir: string): Promise<SpecIndex> {
  const index = await buildIndex(rootDir);
  await writeIndex(rootDir, index);
  return index;
}

/**
 * Lee el índice de `specs/index.yaml`. Si falta o es inválido, lo regenera desde el
 * filesystem (la verdad) y lo persiste — borrar el índice es seguro.
 */
export async function readIndex(rootDir: string): Promise<SpecIndex> {
  let raw: string;
  try {
    raw = await readFile(indexPath(rootDir), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT")
      return regenerateIndex(rootDir);
    throw err;
  }
  const parsed = SpecIndexSchema.safeParse(parseYaml(raw));
  return parsed.success ? parsed.data : regenerateIndex(rootDir);
}

/** Lee el índice y lo agrupa por producto (forma que consume la API/UI). */
export async function readSpecGroups(rootDir: string): Promise<SpecGroup[]> {
  const index = await readIndex(rootDir);
  const byProduct = new Map<string, SpecIndexEntry[]>();
  for (const entry of index) {
    const list = byProduct.get(entry.product) ?? [];
    list.push(entry);
    byProduct.set(entry.product, list);
  }
  return [...byProduct.entries()]
    .map(([product, specs]) => ({ product, specs }))
    .sort((a, b) => a.product.localeCompare(b.product));
}

// ---------- CRUD con auditoría ----------

export interface CreateSpecInput {
  /** id explícito (kebab-case). Si se omite, se deriva del `name` por slug. */
  id?: string;
  name: string;
  product: string;
  description?: string | null;
}

/** Verdadero si ya existe un directorio de spec con ese id (la verdad, no el índice). */
async function specExists(rootDir: string, id: string): Promise<boolean> {
  try {
    await readFile(specPaths(rootDir, id).spec, "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Crea una spec v0 (id inmutable validado + único), la audita (`spec.create`) y
 * regenera el índice. Devuelve la entrada de índice resultante.
 */
export async function createSpec(
  rootDir: string,
  input: CreateSpecInput,
  actor: string,
): Promise<SpecIndexEntry> {
  const name = input.name.trim();
  const product = input.product.trim();
  if (!name) throw new Error("falta el nombre de la spec");
  if (!product) throw new Error("falta el producto");

  const id = (input.id ?? slugifySpecId(name)).trim();
  if (!isValidSpecId(id))
    throw new Error(
      `id inválido "${id}": debe ser kebab-case (a-z, 0-9, guiones simples)`,
    );
  if (await specExists(rootDir, id))
    throw new Error(`ya existe una spec con id "${id}"`);

  const spec = createSpecV0({
    id,
    title: name,
    product,
    description: input.description ?? null,
  });
  await writeSpec(rootDir, spec);
  await appendAudit(rootDir, {
    actor,
    action: "spec.create",
    spec_id: id,
    reason: `producto "${product}"`,
  });
  const index = await regenerateIndex(rootDir);
  const entry = index.find((e) => e.id === id);
  if (!entry) throw new Error(`spec creada pero ausente del índice: ${id}`);
  return entry;
}

export interface UpdateSpecMetaInput {
  name?: string;
  product?: string;
  description?: string | null;
}

/**
 * Edita los metadatos mutables (name/product/description). El `id` es inmutable y NO
 * se toca. Audita `spec.update` y regenera el índice.
 */
export async function updateSpecMeta(
  rootDir: string,
  id: string,
  patch: UpdateSpecMetaInput,
  actor: string,
): Promise<SpecIndexEntry> {
  const spec = await readSpec(rootDir, id); // 404 si no existe
  const next = { ...spec };
  const changes: string[] = [];
  if (patch.name !== undefined && patch.name.trim() !== spec.title) {
    next.title = patch.name.trim();
    changes.push("name");
  }
  if (patch.product !== undefined && patch.product.trim() !== spec.product) {
    next.product = patch.product.trim();
    changes.push("product");
  }
  if (patch.description !== undefined) {
    const desc = patch.description === null ? null : patch.description.trim();
    if (desc !== spec.description) {
      next.description = desc && desc.length > 0 ? desc : null;
      changes.push("description");
    }
  }
  await writeSpec(rootDir, next); // valida antes de escribir
  await appendAudit(rootDir, {
    actor,
    action: "spec.update",
    spec_id: id,
    reason: changes.length ? `editó ${changes.join(", ")}` : "sin cambios",
  });
  const index = await regenerateIndex(rootDir);
  return index.find((e) => e.id === id)!;
}

/**
 * Archiva una spec (soft delete): `archived: true` + auditoría con motivo. NUNCA borra
 * el directorio (git y la auditoría conservan todo). Regenera el índice.
 */
export async function archiveSpec(
  rootDir: string,
  id: string,
  opts: { reason: string; actor: string },
): Promise<SpecIndexEntry> {
  const reason = opts.reason.trim();
  if (!reason) throw new Error("archivar exige un motivo (invariante 7)");
  const spec = await readSpec(rootDir, id); // 404 si no existe
  await writeSpec(rootDir, { ...spec, archived: true });
  await appendAudit(rootDir, {
    actor: opts.actor,
    action: "spec.archive",
    spec_id: id,
    reason,
  });
  const index = await regenerateIndex(rootDir);
  return index.find((e) => e.id === id)!;
}
