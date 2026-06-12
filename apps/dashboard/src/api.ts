// Acceso a la API del server delgado + hook de datos de la spec, compartido por todas las
// páginas. La spec es la fuente de verdad: aquí se centraliza su lectura y refetch.

import { useCallback, useEffect, useState } from "react";
import type {
  Spec,
  Finding,
  Concept,
  AuditEntry,
  SourceEntry,
  SourceKind,
  DiscoveryMethod,
  DiscoveryInstrument,
} from "@pda/spec";

export type { Concept, SourceEntry, SourceKind } from "@pda/spec";

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

export async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- hub de Fuentes (D2 · W1.4) ---

export function getSources(specId: string): Promise<SourceEntry[]> {
  return getJson<SourceEntry[]>(`/api/specs/${specId}/sources`);
}

/** Sube un archivo (multipart). El server computa size+sha256. */
export async function uploadSource(
  specId: string,
  file: File,
  opts: { kind?: SourceKind; by?: string } = {},
): Promise<Response> {
  const form = new FormData();
  form.append("file", file);
  if (opts.kind) form.append("kind", opts.kind);
  if (opts.by) form.append("by", opts.by);
  return fetch(`/api/specs/${specId}/sources`, { method: "POST", body: form });
}

export function patchSource(
  specId: string,
  sourceId: string,
  patch: {
    kind?: SourceKind;
    status?: string;
    linkedStages?: string[];
    by?: string;
  },
): Promise<Response> {
  return fetch(`/api/specs/${specId}/sources/${sourceId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function discardSource(
  specId: string,
  sourceId: string,
  opts: { reason?: string; by?: string } = {},
): Promise<Response> {
  return fetch(`/api/specs/${specId}/sources/${sourceId}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
}

// --- intake / completitud de fuentes (D2 · W6) ---

export interface SourceCompleteness {
  expected: SourceKind[];
  present: SourceKind[];
  missing: SourceKind[];
  satisfied: boolean;
}

/** Completitud de fuentes: tipos esperados (plan de discovery) vs. subidos. */
export function getSourceCompleteness(
  specId: string,
): Promise<SourceCompleteness> {
  return getJson<SourceCompleteness>(
    `/api/specs/${specId}/sources/completeness`,
  );
}

/** Setea/reemplaza el intake de la spec (base del wizard y el retrofit, W6.3/W6.4). */
export function patchIntake(
  specId: string,
  intake: unknown,
  by?: string,
): Promise<Response> {
  return fetch(`/api/specs/${specId}/intake`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...(intake as object), by }),
  });
}

// --- sugerencia de intake con IA (Sesión 17) ---

/** Borrador de intake sugerido por el modelo (expectedSourceKinds derivado server-side). */
export interface IntakeDraftResult {
  researchQuestion: string;
  hypotheses: string[];
  productContext: string | null;
  methods: DiscoveryMethod[];
  instruments: DiscoveryInstrument[];
  expectedSourceKinds: SourceKind[];
}

/** Pide al server una sugerencia de intake basada en el nombre/producto/descripción. */
export async function suggestIntakeDraft(
  name: string,
  product: string,
  description: string | null,
): Promise<{ draft: IntakeDraftResult; usage: TokenUsage }> {
  const res = await postJson("/api/intake/suggest", { name, product, description });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json() as Promise<{ draft: IntakeDraftResult; usage: TokenUsage }>;
}

// --- revisión humana por hallazgo (D2 · W2.4) ---

export type ReviewStatus = "pendiente" | "aprobado" | "rechazado" | "en_pausa";

export function reviewFinding(
  specId: string,
  fid: string,
  body: { status: ReviewStatus; comment?: string; by?: string },
): Promise<Response> {
  return fetch(`/api/specs/${specId}/findings/${fid}/review`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface StageState {
  specId: string;
  version: number;
  status: string;
  stage: string;
  findings: number;
  hasProposal: boolean;
}

// Entrada del índice de specs (D2 · W0) — la forma que devuelve GET /api/specs.
export interface SpecIndexEntry {
  id: string;
  name: string;
  product: string;
  stage: string;
  status: "activa" | "archivada";
  updatedAt: string | null;
  hasProposal?: boolean; // enriquecido en W0.4 (¿hay spec.proposed.yaml?)
}

export interface SpecGroup {
  product: string;
  specs: SpecIndexEntry[];
}

/** Lista de specs agrupadas por producto (índice cache regenerable). */
export function getSpecGroups(): Promise<SpecGroup[]> {
  return getJson<SpecGroup[]>("/api/specs");
}

export interface SpecData {
  specId: string | null;
  spec: Spec | null;
  proposed: Spec | null;
  findings: Finding[];
  concepts: Concept[];
  audit: AuditEntry[];
  state: StageState | null;
  error: string | null;
  refetch: () => void;
}

export function useSpecData(specId: string | null): SpecData {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [proposed, setProposed] = useState<Spec | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [state, setState] = useState<StageState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!specId) return;
    try {
      const [s, p, f, co, a, st] = await Promise.all([
        getJson<Spec>(`/api/spec/${specId}`),
        getJson<Spec | null>(`/api/proposed/${specId}`),
        getJson<Finding[]>(`/api/findings/${specId}`).catch(() => []),
        getJson<Concept[]>(`/api/specs/${specId}/concepts`).catch(() => []),
        getJson<AuditEntry[]>(`/api/audit/${specId}`).catch(() => []),
        getJson<StageState>(`/api/state/${specId}`).catch(() => null),
      ]);
      setSpec(s);
      setProposed(p);
      setFindings(f);
      setConcepts(co);
      setAudit(a);
      setState(st);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [specId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { specId, spec, proposed, findings, concepts, audit, state, error, refetch };
}

// --- triage de conceptos (Exploración, F3-A) ---

export type ConceptReviewStatus = "propuesto" | "seleccionado" | "descartado";

export function reviewConcept(
  specId: string,
  cid: string,
  body: { status: ConceptReviewStatus; note?: string; by?: string },
): Promise<Response> {
  return fetch(`/api/specs/${specId}/concepts/${cid}/review`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Criterio de verificación del orquestador (cierre de Exploración).
export interface GateCriterion {
  criterion: string;
  type: "automated" | "human";
  blocking: boolean;
  status: "pending" | "pass" | "fail";
  evidence: string | null;
}

export function getExplorationVerification(
  specId: string,
): Promise<GateCriterion[]> {
  return getJson<GateCriterion[]>(
    `/api/specs/${specId}/exploration/verification`,
  );
}

export function closeExploration(
  specId: string,
  body: { rationale: string; by: string },
): Promise<Response> {
  return fetch(`/api/specs/${specId}/exploration/close`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- corridas de agente desde la UI (Sesión 16) ---

export type AgentName = "discover" | "define" | "explore";

export interface DiscoverPreflight {
  agent: "discover";
  willDerive: boolean;
  sources: number;
  textSources: number;
  cached: number;
  toExtract: number;
  tabular: number;
  fromSamples: boolean;
  alreadyRan: boolean;
}

export interface LightPreflight {
  agent: "define" | "explore";
  modelCalls: number;
  alreadyRan: boolean;
  findings?: number;
  mergeMode?: boolean;
}

export type Preflight = DiscoverPreflight | LightPreflight;

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  cacheHits?: number;
}

export interface AgentRunSummary {
  agent: AgentName;
  counts: Record<string, number>;
}

export interface RunStatus {
  status: "idle" | "running" | "done" | "error";
  agent?: AgentName;
  by?: string;
  startedAt?: string;
  finishedAt?: string;
  result?: AgentRunSummary;
  tokens?: TokenUsage;
  error?: string;
}

export function getRunPreflight(
  specId: string,
  agent: AgentName,
): Promise<Preflight> {
  return getJson<Preflight>(`/api/specs/${specId}/run/${agent}/preflight`);
}

export function startRun(
  specId: string,
  agent: AgentName,
  by: string,
): Promise<Response> {
  return fetch(`/api/specs/${specId}/run/${agent}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ by }),
  });
}

export function getRunStatus(
  specId: string,
  agent: AgentName,
): Promise<RunStatus> {
  return getJson<RunStatus>(`/api/specs/${specId}/run/${agent}`);
}

// Verificación de Descubrimiento (espejo cliente de los 3 chequeos del orquestador):
// toda evidencia anclada, lo cuantitativo computado, lo cualitativo con cita.
export interface DiscoveryCriterion {
  criterion: string;
  status: "pass" | "fail";
  evidence: string;
}

export function discoveryVerification(
  findings: Finding[],
): DiscoveryCriterion[] {
  const anchored = findings.filter((f) => f.evidence.length > 0).length;
  const quant = findings.filter((f) => f.type === "quantitative");
  const quantOk = quant.filter((f) =>
    f.evidence.some((e) => e.computation !== undefined),
  ).length;
  const qual = findings.filter((f) => f.type === "qualitative");
  const qualOk = qual.filter((f) =>
    f.evidence.some((e) => e.quote !== undefined),
  ).length;
  const crit = (
    criterion: string,
    pass: boolean,
    evidence: string,
  ): DiscoveryCriterion => ({
    criterion,
    status: pass ? "pass" : "fail",
    evidence,
  });
  return [
    crit(
      "Todo hallazgo tiene evidencia anclada",
      anchored === findings.length && findings.length > 0,
      `${anchored}/${findings.length} hallazgos`,
    ),
    crit(
      "Lo cuantitativo está computado, no estimado",
      quantOk === quant.length,
      `${quantOk}/${quant.length} cuantitativos`,
    ),
    crit(
      "Lo cualitativo tiene cita textual",
      qualOk === qual.length,
      `${qualOk}/${qual.length} cualitativos`,
    ),
  ];
}
