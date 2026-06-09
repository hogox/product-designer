// Almacén de la spec: YAML versionado en git (PRD §7 — diff + auditoría gratis).
// Layout por spec: specs/<id>/{spec.yaml, spec.proposed.yaml, findings.yaml, audit.jsonl}.

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { FindingSchema, parseSpec, type Finding, type Spec } from "./schema.js";

const execFileAsync = promisify(execFile);

export interface SpecPaths {
  /** Directorio de la spec: specs/<id>/ */
  dir: string;
  /** spec vigente */
  spec: string;
  /** propuesta v+1 del agente (diff que la UI resalta; se llena en Fase 1) */
  proposed: string;
  /** hallazgos anclados (se llena en Fase 1) */
  findings: string;
  /** log de auditoría append-only */
  audit: string;
}

/** Rutas canónicas de una spec dentro de `rootDir`. */
export function specPaths(rootDir: string, id: string): SpecPaths {
  const dir = join(rootDir, "specs", id);
  return {
    dir,
    spec: join(dir, "spec.yaml"),
    proposed: join(dir, "spec.proposed.yaml"),
    findings: join(dir, "findings.yaml"),
    audit: join(dir, "audit.jsonl"),
  };
}

/** Valida y escribe la spec vigente en `specs/<id>/spec.yaml`. */
export async function writeSpec(rootDir: string, spec: Spec): Promise<string> {
  const valid = parseSpec(spec); // nunca escribimos una spec inválida
  const { dir, spec: specFile } = specPaths(rootDir, valid.id);
  await mkdir(dir, { recursive: true });
  await writeFile(specFile, stringifyYaml(valid), "utf8");
  return specFile;
}

/** Lee y valida la spec vigente de `specs/<id>/spec.yaml`. */
export async function readSpec(rootDir: string, id: string): Promise<Spec> {
  const { spec } = specPaths(rootDir, id);
  const raw = await readFile(spec, "utf8");
  return parseSpec(parseYaml(raw));
}

/** Escribe la propuesta v+1 del agente en `spec.proposed.yaml` (validada). */
export async function writeProposedSpec(
  rootDir: string,
  spec: Spec,
): Promise<string> {
  const valid = parseSpec(spec);
  const { dir, proposed } = specPaths(rootDir, valid.id);
  await mkdir(dir, { recursive: true });
  await writeFile(proposed, stringifyYaml(valid), "utf8");
  return proposed;
}

/** Lee y valida la propuesta de `spec.proposed.yaml`. */
export async function readProposedSpec(
  rootDir: string,
  id: string,
): Promise<Spec> {
  const { proposed } = specPaths(rootDir, id);
  return parseSpec(parseYaml(await readFile(proposed, "utf8")));
}

/** Escribe los hallazgos anclados en `findings.yaml` (cada uno validado). */
export async function writeFindings(
  rootDir: string,
  id: string,
  findings: Finding[],
): Promise<string> {
  const valid = findings.map((f) => FindingSchema.parse(f));
  const { dir, findings: file } = specPaths(rootDir, id);
  await mkdir(dir, { recursive: true });
  await writeFile(file, stringifyYaml(valid), "utf8");
  return file;
}

/** Lee y valida los hallazgos de `findings.yaml` (vacío si no existe). */
export async function readFindings(
  rootDir: string,
  id: string,
): Promise<Finding[]> {
  const { findings: file } = specPaths(rootDir, id);
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const data = parseYaml(raw);
  return Array.isArray(data) ? data.map((f) => FindingSchema.parse(f)) : [];
}

export interface GitAuthor {
  name: string;
  email: string;
}

/**
 * Commitea el directorio de la spec en git (rootDir debe ser un repo git).
 * El versionado real de la spec (version++) ocurre solo al aprobar una compuerta;
 * este helper solo persiste el cambio con trazabilidad de git.
 */
export async function commitSpec(
  rootDir: string,
  id: string,
  message: string,
  author?: GitAuthor,
): Promise<void> {
  const { dir } = specPaths(rootDir, id);
  await execFileAsync("git", ["add", dir], { cwd: rootDir });
  const identity = author
    ? ["-c", `user.name=${author.name}`, "-c", `user.email=${author.email}`]
    : [];
  await execFileAsync("git", [...identity, "commit", "-m", message], {
    cwd: rootDir,
  });
}
