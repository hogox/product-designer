// Runners reales de las dos etapas del diamante Problema.
// Descubrimiento = pipeline del Agente 1 (recolectar→extraer→computar→derivar → hallazgos).
// Definición = Agente 2 (hallazgos validados → problem statement + JTBD + métricas).

import { readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import type { Evidence, Finding, GitAuthor, Spec } from "@pda/spec";
import {
  readSources,
  readSpec,
  readFindings,
  sourceFilePath,
  updateSource,
} from "@pda/spec";
import {
  ingestFile,
  extractTextEvidence,
  createAnthropicProposer,
  computeFunnelMetrics,
  metricToEvidence,
  buildEvidencePool,
  deriveFindings,
  createAnthropicFindingsProposer,
  computeFileSha256,
  readEvidenceCache,
  writeEvidenceCache,
} from "@pda/agent1";
import { defineProblem, createAnthropicDefiner } from "@pda/agent2";
import {
  exploreConceptsFromJobs,
  createAnthropicExplorer,
} from "@pda/agent3";
import { makeUsageSink } from "@pda/llm";

import {
  runDiscovery,
  type DiscoveryRunner,
  type DefinitionRunner,
  type ExplorationRunner,
  type DiscoveryResult,
} from "./stage.js";

export interface DiscoveryRunnerOptions {
  /** Rutas a los binarios de las fuentes (subidas o de muestra). */
  files: string[];
  topic: string;
  /** Directorio donde persistir/leer el cache de evidencia por sha256. */
  cacheDir?: string;
  /** Si true, fuerza re-extracción aunque haya hit en el cache (útil para A/B). */
  noCache?: boolean;
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
      const usage = makeUsageSink();
      const proposer = createAnthropicProposer({ onUsage: usage.onUsage });
      const model =
        process.env["PDA_MODEL_EXTRACT"] ??
        process.env["PDA_MODEL"] ??
        "claude-opus-4-8";
      let cacheHits = 0;

      // La EXTRACCIÓN se hace sin sesgo (invariante 3): solo el topic neutral, nunca el
      // intake. El grounding del intake entra recién en la DERIVACIÓN (abajo).
      for (const filePath of opts.files) {
        // --- cache hit? ---
        if (opts.cacheDir && !opts.noCache) {
          const sha256 = await computeFileSha256(filePath);
          const cached = await readEvidenceCache(
            opts.cacheDir,
            sha256,
            opts.topic,
          );
          if (cached !== null) {
            evidence.push(...cached);
            cacheHits++;
            process.stderr.write(
              `[cache:hit] ${basename(filePath)} (${cached.length} citas)\n`,
            );
            continue;
          }

          // --- cache miss: extraer y persistir ---
          const fileEvidence: Evidence[] = [];
          for (const doc of await ingestFile(filePath)) {
            if (doc.kind === "text") {
              const { accepted } = await extractTextEvidence(doc, {
                topic: opts.topic,
                proposer,
              });
              evidence.push(...accepted);
              fileEvidence.push(...accepted);
            } else if (doc.kind === "tabular") {
              evidence.push(
                ...computeFunnelMetrics(doc).slice(0, 4).map(metricToEvidence),
              );
            }
          }
          if (fileEvidence.length > 0) {
            await writeEvidenceCache(
              opts.cacheDir,
              sha256,
              opts.topic,
              fileEvidence,
              {
                source: basename(filePath),
                model,
                extractedAt: new Date().toISOString(),
              },
            );
          }
        } else {
          // cache desactivado: extracción directa
          for (const doc of await ingestFile(filePath)) {
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
      }

      if (cacheHits > 0) {
        process.stderr.write(
          `[cache] ${cacheHits}/${opts.files.length} fuentes desde cache (0 tokens de extracción)\n`,
        );
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
        proposer: createAnthropicFindingsProposer({ onUsage: usage.onUsage }),
        grounding,
      });
      return { findings, tokens: { ...usage.totals(), cacheHits } };
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

/** Costo estimado de una corrida de Descubrimiento, antes de gastar tokens (Sesión 16 · P2). */
export interface DiscoverPreflight {
  /** Fuentes resueltas (subidas o de muestra). */
  sources: number;
  /** Fuentes de texto (se extraen con el modelo). */
  textSources: number;
  /** Fuentes de texto ya en el cache de evidencia (0 tokens de extracción). */
  cached: number;
  /** Fuentes de texto a re-extraer (textSources - cached). */
  toExtract: number;
  /** Fuentes tabulares (cómputo determinista, 0 tokens). */
  tabular: number;
  /** Si cae al set de muestra (no hay fuentes subidas). */
  fromSamples: boolean;
  /** ¿Ya hay hallazgos de una corrida previa? (re-correr los reemplaza). */
  alreadyRan: boolean;
}

const TABULAR_EXT = new Set([".csv", ".xlsx", ".xls"]);

/**
 * Calcula el costo de una corrida de Descubrimiento SIN llamar al modelo (P2): resuelve las
 * fuentes y, para cada texto, mira si su sha256 ya está en el cache de evidencia. Permite a la
 * UI mostrar "K se re-extraen, M ya en cache (0 tokens)" y desalentar corridas inútiles.
 */
export async function discoverPreflight(
  rootDir: string,
  specId: string,
  fallback: SampleFallback,
): Promise<DiscoverPreflight> {
  const spec = await readSpec(rootDir, specId);
  const topic = resolveTopic(spec);
  const resolved = await resolveDiscoverySources(rootDir, specId, fallback);
  const cacheDir = join(rootDir, "specs", specId, "evidence-cache");

  let textSources = 0;
  let cached = 0;
  let tabular = 0;
  for (const file of resolved.files) {
    if (TABULAR_EXT.has(extname(file).toLowerCase())) {
      tabular++;
      continue;
    }
    textSources++;
    const sha256 = await computeFileSha256(file);
    const hit = await readEvidenceCache(cacheDir, sha256, topic);
    if (hit !== null) cached++;
  }

  const findings = await readFindings(rootDir, specId);
  return {
    sources: resolved.files.length,
    textSources,
    cached,
    toExtract: textSources - cached,
    tabular,
    fromSamples: resolved.fromSamples,
    alreadyRan: findings.length > 0,
  };
}

export interface RunDiscoveryWithSourcesOptions {
  topic: string;
  fallback: SampleFallback;
  author?: GitAuthor;
  actor?: string;
  /** Si true, fuerza re-extracción ignorando el cache (útil para A/B). */
  noCache?: boolean;
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
  const cacheDir = join(rootDir, "specs", specId, "evidence-cache");
  const makeRunner =
    opts.makeRunner ??
    ((files: string[]) =>
      createDiscoveryRunner({
        files,
        topic: opts.topic,
        cacheDir,
        noCache: opts.noCache,
      }));

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
    async run(current: Spec, findings: Finding[], feedback?: string) {
      const usage = makeUsageSink();
      const { proposed } = await defineProblem(current, findings, {
        topic: opts.topic,
        definer: createAnthropicDefiner({ onUsage: usage.onUsage }),
        feedback,
      });
      return { proposed, tokens: usage.totals() };
    },
  };
}

/**
 * Topic de la etapa derivado de la spec (no una constante hardcodeada): la pregunta de
 * investigación del intake si existe, si no el título de la spec. Lo usan los tres agentes
 * para no quedar pegados a un producto concreto.
 */
export function resolveTopic(spec: Spec): string {
  return spec.intake?.researchQuestion ?? spec.title;
}

export function createExplorationRunner(opts: {
  topic: string;
}): ExplorationRunner {
  return {
    async run(current: Spec, runOpts) {
      const usage = makeUsageSink();
      const { accepted: concepts } = await exploreConceptsFromJobs(
        current.jtbd,
        {
          topic: opts.topic,
          problemStatement: current.problem_statement ?? opts.topic,
          proposer: createAnthropicExplorer({ onUsage: usage.onUsage }),
          discardedFeedback: runOpts?.discardedFeedback,
          firstId: runOpts?.firstId,
          context: {
            productContext: current.intake?.productContext ?? undefined,
            hypotheses: current.intake?.hypotheses,
            constraints: explorationConstraints(current),
            nonGoals: current.scope.non_goals,
          },
        },
      );
      return { concepts, tokens: usage.totals() };
    },
  };
}

/** Restricciones legibles para el explorador (P5): regulatorias + a11y + técnicas + DS. */
function explorationConstraints(spec: Spec): string[] {
  const c = spec.constraints;
  const out: string[] = [...c.regulatory, ...c.technical];
  if (c.accessibility) out.push(`Accesibilidad: ${c.accessibility}`);
  if (c.design_system.name)
    out.push(
      `Design system: ${c.design_system.name} ${c.design_system.version}`.trim(),
    );
  return out;
}
