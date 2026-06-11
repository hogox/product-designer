// Cache de evidencia por sha256 de fuente (Sesión 13 — O1).
// Clave: (sha256[:16], topic-slug) → Evidence[] ya verificada.
// Hit = 0 tokens de extracción. El cache se versiona en git como trazabilidad de procedencia.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Evidence } from "@pda/spec";

export async function computeFileSha256(path: string): Promise<string> {
  const buf = await readFile(path);
  return createHash("sha256").update(buf).digest("hex");
}

function cacheFilename(sha256: string, topic: string): string {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `${sha256.slice(0, 16)}-${slug}.json`;
}

export interface EvidenceCacheMeta {
  source: string;
  model: string;
  extractedAt: string;
}

/** Lee evidencia cacheada; null si no hay hit o el archivo está corrupto. */
export async function readEvidenceCache(
  cacheDir: string,
  sha256: string,
  topic: string,
): Promise<Evidence[] | null> {
  const file = join(cacheDir, cacheFilename(sha256, topic));
  try {
    const raw = await readFile(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "evidence" in parsed &&
      Array.isArray((parsed as { evidence: unknown }).evidence)
    ) {
      return (parsed as { evidence: Evidence[] }).evidence;
    }
    return null;
  } catch {
    return null;
  }
}

/** Persiste evidencia verificada al cache. */
export async function writeEvidenceCache(
  cacheDir: string,
  sha256: string,
  topic: string,
  evidence: Evidence[],
  meta: EvidenceCacheMeta,
): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  const file = join(cacheDir, cacheFilename(sha256, topic));
  await writeFile(
    file,
    JSON.stringify({ sha256, topic, evidence, ...meta }, null, 2),
    "utf8",
  );
}
