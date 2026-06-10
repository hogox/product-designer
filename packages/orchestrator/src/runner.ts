// Runners reales de las dos etapas del diamante Problema.
// Descubrimiento = pipeline del Agente 1 (recolectar→extraer→computar→derivar → hallazgos).
// Definición = Agente 2 (hallazgos validados → problem statement + JTBD + métricas).

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { Evidence, Finding, GitAuthor, Spec } from "@pda/spec";
import { readSources, sourceFilePath, updateSource } from "@pda/spec";
import {
  ingestFile,
  extractTextEvidence,
  createAnthropicProposer,
  computeFunnelMetrics,
  metricToEvidence,
  buildEvidencePool,
  deriveFindings,
  createAnthropicFindingsProposer,
} from "@pda/agent1";
import { defineProblem, createAnthropicDefiner } from "@pda/agent2";

import {
  runDiscovery,
  type DiscoveryRunner,
  type DefinitionRunner,
  type DiscoveryResult,
} from "./stage.js";

export interface DiscoveryRunnerOptions {
  /** Rutas a los binarios de las fuentes (subidas o de muestra). */
  files: string[];
  topic: string;
}

/**
 * Runner de Descubrimiento (Agente 1): ingiere cada archivo y rutea por TIPO ingerido
 * (independiente del label `kind` de la fuente): `text` → citas verificadas; `tabular` →
 * métricas computadas. Reúne la evidencia y deriva hallazgos anclados.
 */
export function createDiscoveryRunner(
  opts: DiscoveryRunnerOptions,
): DiscoveryRunner {
  return {
    async run(current: Spec) {
      const evidence: Evidence[] = [];
      const proposer = createAnthropicProposer();

      // La EXTRACCIÓN se hace sin sesgo (invariante 3): solo el topic neutral, nunca el
      // intake. El grounding del intake entra recién en la DERIVACIÓN (abajo).
      for (const path of opts.files) {
        for (const doc of await ingestFile(path)) {
          if (doc.kind === "text") {
            const { accepted } = await extractTextEvidence(doc, {
              topic: opts.topic,
              proposer,
            });
            evidence.push(...accepted);
          } else if (doc.kind === "tabular") {
            evidence.push(
              ...computeFunnelMetrics(doc).slice(0, 4).map(metricToEvidence),
            );
          }
        }
      }

      // Grounding derivado del intake de la spec (W6.2): orienta QUÉ derivar del pool ya
      // fijo. Sin intake → undefined → derivación idéntica a la de antes (sin regresión).
      const grounding = current.intake
        ? {
            researchQuestion: current.intake.researchQuestion,
            productContext: current.intake.productContext,
            hypotheses: current.intake.hypotheses,
          }
        : undefined;

      const pool = buildEvidencePool(evidence);
      const { accepted: findings } = await deriveFindings(pool, {
        topic: opts.topic,
        proposer: createAnthropicFindingsProposer(),
        grounding,
      });
      return { findings };
    },
  };
}

/** Fuentes de muestra a las que caer cuando la spec no tiene fuentes subidas (W1.3). */
export interface SampleFallback {
  entrevistasDir: string;
  funnelCsv: string;
}

export interface ResolvedSources {
  files: string[];
  /** ids de las fuentes subidas usadas (para marcarlas `ingerido`); vacío si son samples. */
  sourceIds: string[];
  fromSamples: boolean;
}

async function listDirFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => join(dir, e.name));
}

/**
 * Resuelve qué archivos alimentan a Descubrimiento: si el manifest tiene fuentes
 * `subido|ingerido`, usa `sources/files/`; si no, cae a `samples/` (transición suave, W1.3).
 */
export async function resolveDiscoverySources(
  rootDir: string,
  specId: string,
  fallback: SampleFallback,
): Promise<ResolvedSources> {
  const sources = await readSources(rootDir, specId);
  const usable = sources.filter(
    (s) => s.status === "subido" || s.status === "ingerido",
  );
  if (usable.length > 0) {
    return {
      files: usable.map((s) => sourceFilePath(rootDir, specId, s.id, s.filename)),
      sourceIds: usable.map((s) => s.id),
      fromSamples: false,
    };
  }
  return {
    files: [...(await listDirFiles(fallback.entrevistasDir)), fallback.funnelCsv],
    sourceIds: [],
    fromSamples: true,
  };
}

export interface RunDiscoveryWithSourcesOptions {
  topic: string;
  fallback: SampleFallback;
  author?: GitAuthor;
  actor?: string;
  /** Inyectable para tests (default: el runner real del Agente 1). */
  makeRunner?: (files: string[]) => DiscoveryRunner;
}

/**
 * Orquesta Descubrimiento desde las fuentes de la spec: resuelve archivos → corre el Agente 1
 * → marca `ingerido` las fuentes subidas que se usaron. Seam reutilizable (CLI y, a futuro, API).
 */
export async function runDiscoveryWithSources(
  rootDir: string,
  specId: string,
  opts: RunDiscoveryWithSourcesOptions,
): Promise<DiscoveryResult & { fromSamples: boolean; sourceIds: string[] }> {
  const resolved = await resolveDiscoverySources(rootDir, specId, opts.fallback);
  const makeRunner =
    opts.makeRunner ??
    ((files: string[]) => createDiscoveryRunner({ files, topic: opts.topic }));

  const result = await runDiscovery(rootDir, specId, {
    runner: makeRunner(resolved.files),
    author: opts.author,
    actor: opts.actor,
  });

  // marcar ingerido SOLO las fuentes subidas que se usaron (no las de muestra)
  if (!resolved.fromSamples) {
    for (const sid of resolved.sourceIds) {
      await updateSource(
        rootDir,
        specId,
        sid,
        { status: "ingerido" },
        opts.actor ?? "orchestrator",
      );
    }
  }

  return { ...result, fromSamples: resolved.fromSamples, sourceIds: resolved.sourceIds };
}

export function createDefinitionRunner(opts: {
  topic: string;
}): DefinitionRunner {
  return {
    async run(current: Spec, findings: Finding[]) {
      const { proposed } = await defineProblem(current, findings, {
        topic: opts.topic,
        definer: createAnthropicDefiner(),
      });
      return { proposed };
    },
  };
}
