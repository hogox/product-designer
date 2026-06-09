// Log de auditoría (invariante 7): quién / qué / cuándo, y por qué se rechazó un hallazgo.
// Append-only en `specs/<id>/audit.jsonl` (una entrada JSON por línea).

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import { z } from "zod";

import { specPaths } from "./store.js";

export const AuditEntrySchema = z.object({
  timestamp: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "datetime ISO inválido")
    .default(() => new Date().toISOString()), // cuándo
  actor: z.string().min(1), // quién (humano o agente)
  action: z.string().min(1), // qué (p. ej. spec.create, gate.approve, finding.reject)
  spec_id: z.string().min(1),
  target: z.string().min(1).nullable().default(null), // a qué aplica (p. ej. F-003)
  reason: z.string().min(1).nullable().default(null), // por qué (p. ej. motivo de rechazo)
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;
export type AuditEntryInput = z.input<typeof AuditEntrySchema>;

/** Añade una entrada al log de auditoría de la spec; devuelve la entrada normalizada. */
export async function appendAudit(
  rootDir: string,
  entry: AuditEntryInput,
): Promise<AuditEntry> {
  const parsed = AuditEntrySchema.parse(entry);
  const { audit } = specPaths(rootDir, parsed.spec_id);
  await mkdir(dirname(audit), { recursive: true });
  await appendFile(audit, JSON.stringify(parsed) + "\n", "utf8");
  return parsed;
}

/** Lee el log de auditoría de la spec (vacío si el archivo no existe). */
export async function readAudit(
  rootDir: string,
  specId: string,
): Promise<AuditEntry[]> {
  const { audit } = specPaths(rootDir, specId);
  let raw: string;
  try {
    raw = await readFile(audit, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => AuditEntrySchema.parse(JSON.parse(line)));
}
