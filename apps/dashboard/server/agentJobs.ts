// Registro de jobs de agente en memoria (Sesión 16): disparar discover/define/explore desde
// la UI sin bloquear la request HTTP. El POST arranca el job y vuelve; la UI poll-ea el GET.
// Lock por (specId, agente): un segundo disparo mientras corre → conflicto (409). El registro
// es volátil (no persiste entre reinicios): la corrida es idempotente sobre el store, así que
// si el server reinicia a mitad de corrida, se vuelve a disparar.

export type AgentName = "discover" | "define" | "explore";

export const AGENT_NAMES: AgentName[] = ["discover", "define", "explore"];

export function isAgentName(s: string): s is AgentName {
  return (AGENT_NAMES as string[]).includes(s);
}

/** Tokens consumidos por una corrida (P3): suma de las llamadas al modelo + cache hits. */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  /** Fuentes resueltas desde el cache de evidencia (0 tokens de extracción). */
  cacheHits?: number;
}

/** Resumen del resultado de una corrida (conteos por agente). */
export interface AgentRunSummary {
  agent: AgentName;
  counts: Record<string, number>;
}

export type JobStatus = "idle" | "running" | "done" | "error";

export interface AgentJob {
  specId: string;
  agent: AgentName;
  status: Exclude<JobStatus, "idle">;
  by: string;
  startedAt: string;
  finishedAt?: string;
  result?: AgentRunSummary;
  tokens?: TokenUsage;
  error?: string;
}

/** Vista serializable del estado de un job para el GET (idle si no hay job). */
export interface JobView {
  status: JobStatus;
  agent?: AgentName;
  by?: string;
  startedAt?: string;
  finishedAt?: string;
  result?: AgentRunSummary;
  tokens?: TokenUsage;
  error?: string;
}

export class JobConflictError extends Error {}

const jobs = new Map<string, AgentJob>();
const key = (specId: string, agent: AgentName) => `${specId}:${agent}`;

export function getJob(specId: string, agent: AgentName): AgentJob | undefined {
  return jobs.get(key(specId, agent));
}

export function isRunning(specId: string, agent: AgentName): boolean {
  return getJob(specId, agent)?.status === "running";
}

export function jobView(job: AgentJob | undefined): JobView {
  if (!job) return { status: "idle" };
  return {
    status: job.status,
    agent: job.agent,
    by: job.by,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    result: job.result,
    tokens: job.tokens,
    error: job.error,
  };
}

/**
 * Arranca un job de agente en background. Lanza JobConflictError si ya hay uno corriendo para
 * ese (spec, agente). El `fn` hace la corrida real (llama al orquestador) y devuelve el resumen
 * + tokens; sus errores se capturan en el job (status `error`), nunca tumban el server.
 */
export function startAgentJob(
  specId: string,
  agent: AgentName,
  by: string,
  fn: () => Promise<{ result: AgentRunSummary; tokens?: TokenUsage }>,
): AgentJob {
  if (isRunning(specId, agent)) {
    throw new JobConflictError(
      `ya hay una corrida de '${agent}' en curso para '${specId}'`,
    );
  }
  const job: AgentJob = {
    specId,
    agent,
    status: "running",
    by,
    startedAt: new Date().toISOString(),
  };
  jobs.set(key(specId, agent), job);

  void fn()
    .then(({ result, tokens }) => {
      job.status = "done";
      job.result = result;
      job.tokens = tokens;
      job.finishedAt = new Date().toISOString();
    })
    .catch((err: unknown) => {
      job.status = "error";
      job.error = err instanceof Error ? err.message : String(err);
      job.finishedAt = new Date().toISOString();
    });

  return job;
}
