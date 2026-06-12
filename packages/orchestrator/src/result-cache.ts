// Cache de resultados de modelo por hash de inputs (Sesión 17 — O2 · P2).
// Extiende el patrón del cache de evidencia (Sesión 13 · P3) a derive/define/explore:
// mismos inputs + mismo modelo → mismo resultado, 0 tokens. El hash cubre TODO lo que
// entra al prompt (pool/findings/jobs, grounding/feedback, modelo); cualquier cambio —
// un hallazgo aprobado distinto, un feedback nuevo, otro modelo — invalida el hit.
// Se cachea el output CRUDO del modelo: el ensamblado/validación (código determinista)
// se re-ejecuta siempre, así una mejora en la validación aplica sin invalidar el cache.
// Los archivos se versionan en git (trazabilidad de procedencia, invariante 7).

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Hash estable de los inputs de una llamada (sha256 del JSON canónico-por-construcción). */
export function hashResultInputs(inputs: unknown): string {
  return createHash("sha256").update(JSON.stringify(inputs)).digest("hex");
}

function cacheFilename(kind: string, hash: string): string {
  return `${kind}-${hash.slice(0, 16)}.json`;
}

/** Lee un resultado cacheado; null si no hay hit o el archivo está corrupto. */
export async function readResultCache<T>(
  cacheDir: string,
  kind: string,
  hash: string,
): Promise<T | null> {
  const file = join(cacheDir, cacheFilename(kind, hash));
  try {
    const raw = await readFile(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "hash" in parsed &&
      (parsed as { hash: unknown }).hash === hash &&
      "payload" in parsed
    ) {
      return (parsed as { payload: T }).payload;
    }
    return null;
  } catch {
    return null;
  }
}

/** Persiste el output crudo del modelo al cache. */
export async function writeResultCache(
  cacheDir: string,
  kind: string,
  hash: string,
  payload: unknown,
  meta: { model: string; createdAt: string },
): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  const file = join(cacheDir, cacheFilename(kind, hash));
  await writeFile(
    file,
    JSON.stringify({ kind, hash, ...meta, payload }, null, 2),
    "utf8",
  );
}

export interface CachedModelCallOptions<T> {
  /** Directorio del cache (specs/<id>/result-cache). Sin él, la llamada va directo al modelo. */
  cacheDir?: string;
  /** Si true, fuerza la llamada real aunque haya hit (consistente con el cache de evidencia). */
  noCache?: boolean;
  kind: "derive" | "define" | "explore";
  model: string;
  /** TODO lo que entra al prompt; el hash lo cubre completo. Usar null (no undefined) en opcionales. */
  inputs: unknown;
  call: () => Promise<T>;
}

/**
 * Llama al modelo a través del cache: hit → payload cacheado (0 tokens); miss → llamada
 * real + persistencia. `fromCache` permite al caller loguear/contabilizar el ahorro.
 */
export async function cachedModelCall<T>(
  opts: CachedModelCallOptions<T>,
): Promise<{ payload: T; fromCache: boolean }> {
  if (!opts.cacheDir || opts.noCache) {
    return { payload: await opts.call(), fromCache: false };
  }
  const hash = hashResultInputs({
    kind: opts.kind,
    model: opts.model,
    inputs: opts.inputs,
  });
  const cached = await readResultCache<T>(opts.cacheDir, opts.kind, hash);
  if (cached !== null) {
    process.stderr.write(`[cache:hit] ${opts.kind} (0 tokens)\n`);
    return { payload: cached, fromCache: true };
  }
  const payload = await opts.call();
  await writeResultCache(opts.cacheDir, opts.kind, hash, payload, {
    model: opts.model,
    createdAt: new Date().toISOString(),
  });
  return { payload, fromCache: false };
}
