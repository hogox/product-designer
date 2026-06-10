// Hub de Fuentes (Fase D2 · W1): documentación subida por el usuario, versionada junto a
// la spec, que alimenta al Agente 1 (Descubrimiento). Layout por spec:
//   specs/<id>/sources/manifest.yaml          — metadatos validados (zod)
//   specs/<id>/sources/files/<sourceId>/<filename-original>  — el binario
//
// El subdir por id evita colisiones y PRESERVA el nombre original + extensión: así
// `ingestFile` (que despacha por extensión) funciona y la evidencia cita el archivo real.
// size y sha256 se COMPUTAN del binario en el server (invariante 4/5: no se confían del
// cliente). Descartar es soft delete: status `descartado`, nunca se borra el binario.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";

import { appendAudit } from "./audit.js";
import { SourceKindSchema, StageSchema, type SourceKind } from "./schema.js";
import { specPaths } from "./store.js";

// ---------- esquema ----------

// SourceKindSchema/SourceKind viven en schema.ts (vocabulario core compartido con el intake);
// se re-exportan acá para no romper imports `from "@pda/spec"` existentes.
export { SourceKindSchema, type SourceKind };

export const SourceStatusSchema = z.enum(["subido", "ingerido", "descartado"]);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

const isoDateTime = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "datetime ISO inválido");

export const SourceEntrySchema = z.object({
  id: z.string().min(1), // S-001, S-002, …
  filename: z.string().min(1),
  mime: z.string().min(1),
  kind: SourceKindSchema,
  size: z.number().int().nonnegative(), // bytes (computado del binario)
  sha256: z.string().length(64), // hex (computado del binario)
  uploadedBy: z.string().min(1),
  uploadedAt: isoDateTime,
  status: SourceStatusSchema,
  linkedStages: z.array(StageSchema).default([]), // etapas asociadas
});
export type SourceEntry = z.infer<typeof SourceEntrySchema>;

export const SourceManifestSchema = z.array(SourceEntrySchema);
export type SourceManifest = z.infer<typeof SourceManifestSchema>;

// ---------- rutas ----------

export interface SourcePaths {
  dir: string; // specs/<id>/sources
  manifest: string; // .../manifest.yaml
  filesDir: string; // .../files
}

export function sourcePaths(rootDir: string, specId: string): SourcePaths {
  const dir = join(specPaths(rootDir, specId).dir, "sources");
  return {
    dir,
    manifest: join(dir, "manifest.yaml"),
    filesDir: join(dir, "files"),
  };
}

/** Ruta del binario de una fuente: files/<sourceId>/<filename> (nombre preservado). */
export function sourceFilePath(
  rootDir: string,
  specId: string,
  sourceId: string,
  filename: string,
): string {
  return join(sourcePaths(rootDir, specId).filesDir, sourceId, filename);
}

// ---------- helpers ----------

/** Infiere un kind por defecto desde el mime/extensión (entrevista nunca se infiere). */
export function inferKind(mime: string, filename: string): SourceKind {
  const ext = extname(filename).toLowerCase();
  const m = mime.toLowerCase();
  if (
    ext === ".csv" ||
    ext === ".xlsx" ||
    ext === ".xls" ||
    m.includes("csv") ||
    m.includes("spreadsheet") ||
    m.includes("excel")
  )
    return "datos";
  if (
    ext === ".pdf" ||
    ext === ".txt" ||
    ext === ".md" ||
    ext === ".docx" ||
    m.includes("pdf") ||
    m.startsWith("text/") ||
    m.includes("word")
  )
    return "documento";
  return "otro";
}

/** Siguiente id S-NNN a partir de los existentes en el manifest. */
function nextSourceId(entries: SourceEntry[]): string {
  let max = 0;
  for (const e of entries) {
    const m = /^S-(\d+)$/.exec(e.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `S-${String(max + 1).padStart(3, "0")}`;
}

// ---------- store ----------

/** Lee el manifest de fuentes (validado); [] si no existe. */
export async function readSources(
  rootDir: string,
  specId: string,
): Promise<SourceEntry[]> {
  const { manifest } = sourcePaths(rootDir, specId);
  let raw: string;
  try {
    raw = await readFile(manifest, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const data = parseYaml(raw);
  return Array.isArray(data) ? SourceManifestSchema.parse(data) : [];
}

/** Escribe el manifest (validado antes de persistir). */
export async function writeManifest(
  rootDir: string,
  specId: string,
  entries: SourceEntry[],
): Promise<string> {
  const valid = SourceManifestSchema.parse(entries);
  const { dir, manifest } = sourcePaths(rootDir, specId);
  await mkdir(dir, { recursive: true });
  await writeFile(manifest, stringifyYaml(valid), "utf8");
  return manifest;
}

export interface AddSourceInput {
  filename: string;
  mime: string;
  bytes: Buffer;
  uploadedBy: string;
  kind?: SourceKind; // si se omite, se infiere
}

/**
 * Agrega una fuente: computa size+sha256 del binario, asigna id S-NNN, persiste el binario
 * con su nombre original, actualiza el manifest y audita `source.upload`.
 */
export async function addSource(
  rootDir: string,
  specId: string,
  input: AddSourceInput,
  actor: string,
): Promise<SourceEntry> {
  const filename = input.filename.trim();
  if (!filename) throw new Error("falta el nombre del archivo");
  if (input.bytes.length === 0) throw new Error("el archivo está vacío");

  const entries = await readSources(rootDir, specId);
  const id = nextSourceId(entries);
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");

  const entry: SourceEntry = SourceEntrySchema.parse({
    id,
    filename,
    mime: input.mime || "application/octet-stream",
    kind: input.kind ?? inferKind(input.mime, filename),
    size: input.bytes.length,
    sha256,
    uploadedBy: input.uploadedBy,
    uploadedAt: new Date().toISOString(),
    status: "subido",
    linkedStages: [],
  });

  // persistir el binario (files/<id>/<filename>) antes de tocar el manifest
  const filePath = sourceFilePath(rootDir, specId, id, filename);
  await mkdir(join(sourcePaths(rootDir, specId).filesDir, id), {
    recursive: true,
  });
  await writeFile(filePath, input.bytes);

  await writeManifest(rootDir, specId, [...entries, entry]);
  await appendAudit(rootDir, {
    actor,
    action: "source.upload",
    spec_id: specId,
    target: id,
    reason: `${filename} (${entry.kind})`,
  });
  return entry;
}

export interface UpdateSourceInput {
  kind?: SourceKind;
  status?: SourceStatus;
  linkedStages?: z.infer<typeof StageSchema>[];
}

/** Edita metadatos de una fuente (kind/status/asociación) y audita `source.update`. */
export async function updateSource(
  rootDir: string,
  specId: string,
  sourceId: string,
  patch: UpdateSourceInput,
  actor: string,
): Promise<SourceEntry> {
  const entries = await readSources(rootDir, specId);
  const idx = entries.findIndex((e) => e.id === sourceId);
  if (idx < 0) throw new Error(`fuente no encontrada: ${sourceId}`);

  const current = entries[idx]!;
  const changes: string[] = [];
  const next: SourceEntry = { ...current };
  if (patch.kind !== undefined && patch.kind !== current.kind) {
    next.kind = patch.kind;
    changes.push("kind");
  }
  if (patch.status !== undefined && patch.status !== current.status) {
    next.status = patch.status;
    changes.push("status");
  }
  if (patch.linkedStages !== undefined) {
    next.linkedStages = patch.linkedStages;
    changes.push("linkedStages");
  }

  const updated = [...entries];
  updated[idx] = SourceEntrySchema.parse(next);
  await writeManifest(rootDir, specId, updated);
  await appendAudit(rootDir, {
    actor,
    action: "source.update",
    spec_id: specId,
    target: sourceId,
    reason: changes.length ? `editó ${changes.join(", ")}` : "sin cambios",
  });
  return updated[idx]!;
}

/**
 * Descarta una fuente (soft delete): status `descartado` + auditoría. NUNCA borra el
 * binario (auditoría y git conservan todo).
 */
export async function discardSource(
  rootDir: string,
  specId: string,
  sourceId: string,
  opts: { actor: string; reason?: string },
): Promise<SourceEntry> {
  const entries = await readSources(rootDir, specId);
  const idx = entries.findIndex((e) => e.id === sourceId);
  if (idx < 0) throw new Error(`fuente no encontrada: ${sourceId}`);

  const updated = [...entries];
  updated[idx] = SourceEntrySchema.parse({
    ...updated[idx],
    status: "descartado",
  });
  await writeManifest(rootDir, specId, updated);
  await appendAudit(rootDir, {
    actor: opts.actor,
    action: "source.discard",
    spec_id: specId,
    target: sourceId,
    reason: opts.reason?.trim() || "descartada",
  });
  return updated[idx]!;
}
