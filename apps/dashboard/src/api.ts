// Acceso a la API del server delgado + hook de datos de la spec, compartido por todas las
// páginas. La spec es la fuente de verdad: aquí se centraliza su lectura y refetch.

import { useCallback, useEffect, useState } from "react";
import type { Spec, Finding, AuditEntry } from "@pda/spec";

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

export interface StageState {
  specId: string;
  version: number;
  status: string;
  stage: string;
  findings: number;
  hasProposal: boolean;
}

export interface SpecData {
  specId: string | null;
  spec: Spec | null;
  proposed: Spec | null;
  findings: Finding[];
  audit: AuditEntry[];
  state: StageState | null;
  error: string | null;
  refetch: () => void;
}

export function useSpecData(specId: string | null): SpecData {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [proposed, setProposed] = useState<Spec | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [state, setState] = useState<StageState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!specId) return;
    try {
      const [s, p, f, a, st] = await Promise.all([
        getJson<Spec>(`/api/spec/${specId}`),
        getJson<Spec | null>(`/api/proposed/${specId}`),
        getJson<Finding[]>(`/api/findings/${specId}`).catch(() => []),
        getJson<AuditEntry[]>(`/api/audit/${specId}`).catch(() => []),
        getJson<StageState>(`/api/state/${specId}`).catch(() => null),
      ]);
      setSpec(s);
      setProposed(p);
      setFindings(f);
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

  return { specId, spec, proposed, findings, audit, state, error, refetch };
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
