import { useCallback, useEffect, useState } from "react";
import type {
  Spec,
  Finding,
  AuditEntry,
  VerificationCriterion,
} from "@pda/spec";

interface PipelineStage {
  n: number;
  id: string;
  name: string;
  diamante: string;
  modo: string;
  gate: string | null;
  status: string;
  real: boolean;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function App() {
  const [specId, setSpecId] = useState<string | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [proposed, setProposed] = useState<Spec | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (id: string) => {
    const [s, p, f, a] = await Promise.all([
      getJson<Spec>(`/api/spec/${id}`),
      getJson<Spec | null>(`/api/proposed/${id}`),
      getJson<Finding[]>(`/api/findings/${id}`).catch(() => []),
      getJson<AuditEntry[]>(`/api/audit/${id}`).catch(() => []),
    ]);
    setSpec(s);
    setProposed(p);
    setFindings(f);
    setAudit(a);
  }, []);

  useEffect(() => {
    getJson<string[]>("/api/specs")
      .then((ids) => setSpecId(ids[0] ?? null))
      .catch((e) => setError(String(e)));
    getJson<PipelineStage[]>("/api/pipeline")
      .then(setPipeline)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (specId) refetch(specId).catch((e) => setError(String(e)));
  }, [specId, refetch]);

  const enmarcar = pipeline.find((s) => s.gate === "enmarcar");
  const hasProposal = proposed !== null;
  const shown = proposed ?? spec;
  const discoveryPhase = !hasProposal && findings.length > 0;
  const showTriage = findings.length > 0;

  return (
    <>
      <header className="app-header">
        <div>
          <h1>Product Designer Agéntico</h1>
          <div className="sub">
            Dashboard centrado en la spec · Fase 2 (diamante Problema) — el
            agente propone, el humano aprueba
          </div>
        </div>
        <div className="legend">
          <span>
            <span className="dot real" /> real
          </span>
          <span>
            <span className="dot mock" /> mockeado
          </span>
        </div>
      </header>

      {error && (
        <div className="panel error" style={{ margin: 24 }}>
          Error: {error}
        </div>
      )}

      <div className="layout">
        <div>
          {hasProposal && (
            <div className="panel" style={{ borderColor: "var(--accent)" }}>
              <h2>
                Propuesta de Definición (Agente 2){" "}
                <span className="badge real">pendiente</span>
              </h2>
              <div className="meta">
                El Agente 2 propone la <strong>v+1</strong> con problem
                statement, JTBD y métricas, desde los hallazgos validados. La
                versión sube solo si el humano aprueba la compuerta{" "}
                <em>enmarcar</em>.
              </div>
              <VerificationPanel criteria={shown!.verification} />
            </div>
          )}

          {discoveryPhase && (
            <div className="panel" style={{ borderColor: "var(--accent)" }}>
              <h2>
                Descubrimiento (Agente 1){" "}
                <span className="badge real">{findings.length} hallazgos</span>
              </h2>
              <div className="meta">
                Triá los hallazgos abajo (validación micro). Luego corré
                Definición (<code>orchestrator define</code>) para que el Agente
                2 produzca el enmarcado: problem statement, JTBD y métricas.
              </div>
            </div>
          )}

          <SpecViewer spec={shown} current={spec} isProposal={hasProposal} />

          {showTriage && specId && (
            <FindingsTriage
              specId={specId}
              findings={findings}
              onChange={() => refetch(specId)}
            />
          )}
        </div>

        <div>
          <PipelinePanel stages={pipeline} />
          <GatePanel
            specId={specId}
            gate={enmarcar}
            proposed={proposed}
            onChange={() => specId && refetch(specId)}
          />
          <AuditPanel entries={audit} />
        </div>
      </div>
    </>
  );
}

function VerificationPanel({
  criteria,
}: {
  criteria: VerificationCriterion[];
}) {
  if (criteria.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      {criteria.map((c, i) => (
        <div key={i} className="meta" style={{ marginBottom: 2 }}>
          <span className={`badge ${c.status === "pass" ? "real" : "mock"}`}>
            {c.status === "pass" ? "✓" : "✗"}
          </span>{" "}
          {c.criterion} — {c.evidence}
        </div>
      ))}
    </div>
  );
}

function SpecViewer({
  spec,
  current,
  isProposal,
}: {
  spec: Spec | null;
  current: Spec | null;
  isProposal: boolean;
}) {
  if (!spec) {
    return (
      <div className="panel">
        <h2>Spec</h2>
        <p className="empty">Cargando spec…</p>
      </div>
    );
  }
  const isNew = (cond: boolean) =>
    isProposal && cond ? <span className="badge real">nuevo</span> : null;

  return (
    <div className="panel">
      <h2>
        Spec{" "}
        {isProposal ? (
          <span className="badge real">propuesta v{spec.version}+1</span>
        ) : (
          <span className="badge real">real</span>
        )}
      </h2>
      <div className="spec-meta">
        <span className="pill">id: {spec.id}</span>
        <span className="pill">v{spec.version}</span>
        <span className="pill">{spec.status}</span>
        <span className="pill">etapa: {spec.current_stage}</span>
      </div>
      <div className="spec-title">{spec.title}</div>

      {spec.problem_statement && (
        <Section title="Problem statement (Definición ligera)">
          {isNew(!current?.problem_statement)}
          <div>{spec.problem_statement}</div>
        </Section>
      )}

      <Section title="1 · Outcomes">
        {isNew(
          (current?.outcomes.length ?? 0) === 0 && spec.outcomes.length > 0,
        )}
        {spec.outcomes.length === 0 ? (
          <Empty />
        ) : (
          <ul className="tight">
            {spec.outcomes.map((o, i) => (
              <li key={i}>
                {o.heart && <span className="badge mock">{o.heart}</span>}{" "}
                <strong>{o.metric}</strong>: {o.baseline ?? "—"} → {o.target}{" "}
                <span className="meta">({o.method})</span>
                {o.signals && o.signals.length > 0 && (
                  <div className="meta">señales: {o.signals.join("; ")}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {spec.jtbd.length > 0 && (
        <Section title="JTBD — Jobs To Be Done">
          {isNew((current?.jtbd.length ?? 0) === 0 && spec.jtbd.length > 0)}
          <ul className="tight">
            {spec.jtbd.map((j) => (
              <li key={j.id}>
                {j.statement}{" "}
                <span className="meta">
                  ({j.id} ← {j.supported_by.join(", ")})
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="2 · Alcance">
        {isNew(
          (current?.scope.in_scope.length ?? 0) === 0 &&
            spec.scope.in_scope.length > 0,
        )}
        <div>
          <em>In-scope:</em>{" "}
          {spec.scope.in_scope.length ? spec.scope.in_scope.join("; ") : "—"}
        </div>
        <div>
          <em>Non-goals:</em>{" "}
          {spec.scope.non_goals.length ? spec.scope.non_goals.join("; ") : "—"}
        </div>
      </Section>

      <Section title="5 · Tareas (hipótesis de Definición)">
        {spec.tasks.length === 0 ? (
          <Empty />
        ) : (
          <ul className="tight">
            {spec.tasks.map((t) => (
              <li key={t.id}>
                [{t.status}] {t.description}{" "}
                <span className="meta">({t.owner})</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Historial (procedencia)">
        {spec.history.length === 0 ? (
          <Empty />
        ) : (
          <ul className="tight">
            {spec.history.map((h, i) => (
              <li key={i}>
                v{h.version} — {h.change_summary}{" "}
                <span className="meta">
                  (propuso {h.proposed_by}, aprobó {h.approved_by ?? "—"})
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function FindingsTriage({
  specId,
  findings,
  onChange,
}: {
  specId: string;
  findings: Finding[];
  onChange: () => void;
}) {
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...findings].sort(
    (a, b) => (order[a.confidence] ?? 9) - (order[b.confidence] ?? 9),
  );
  const high = findings.filter((f) => f.confidence === "high").length;

  async function reject(f: Finding) {
    const reason = window.prompt(
      `Motivo del rechazo de ${f.id} (queda en el log de auditoría):`,
    );
    if (!reason) return;
    const res = await postJson(`/api/findings/${specId}/${f.id}/reject`, {
      reason,
      actor: "Lead de diseño",
    });
    if (res.ok) onChange();
  }

  return (
    <div className="panel">
      <h2>
        Triage de hallazgos{" "}
        <span className="badge real">{findings.length}</span>
      </h2>
      <div className="meta" style={{ marginBottom: 10 }}>
        Validación micro (no es la compuerta): {high} en{" "}
        <strong>high confidence</strong> (lote) · concentra la atención en{" "}
        <strong>low</strong> y los de alto impacto. Rechazar pide motivo
        (invariante 7).
      </div>
      {sorted.map((f) => (
        <div
          key={f.id}
          className="stage"
          style={{ alignItems: "flex-start", flexDirection: "column" }}
        >
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <span
              className={`badge ${f.confidence === "high" ? "real" : "mock"}`}
            >
              {f.confidence}
            </span>
            <strong style={{ fontSize: 14, flex: 1 }}>{f.statement}</strong>
            <button
              className="gate iterate"
              style={{ cursor: "pointer", padding: "2px 10px" }}
              onClick={() => reject(f)}
            >
              Rechazar
            </button>
          </div>
          <div className="meta" style={{ marginTop: 4 }}>
            {f.id} · {f.type} · →{f.feeds}
          </div>
          {f.evidence.map((e, i) => (
            <div key={i} className="meta" style={{ paddingLeft: 8 }}>
              └ {e.source} · {e.locator}:{" "}
              {e.quote ? `"${e.quote}"` : e.computation}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function GatePanel({
  specId,
  gate,
  proposed,
  onChange,
}: {
  specId: string | null;
  gate: PipelineStage | undefined;
  proposed: Spec | null;
  onChange: () => void;
}) {
  const pending = proposed !== null;
  const blockingFail =
    proposed?.verification.some((c) => c.blocking && c.status !== "pass") ??
    false;

  async function approve() {
    if (!specId) return;
    const approver = window.prompt(
      "Aprobar la compuerta enmarcar como (rol: lead de diseño / PM):",
    );
    if (!approver) return;
    const res = await postJson(`/api/gate/${specId}/approve`, { approver });
    if (res.ok) onChange();
    else alert((await res.json()).error);
  }

  async function iterate() {
    if (!specId) return;
    const feedback = window.prompt(
      "Feedback para iterar (entra como input del agente):",
    );
    if (!feedback) return;
    const res = await postJson(`/api/gate/${specId}/iterate`, {
      feedback,
      actor: "Lead de diseño",
    });
    if (res.ok) onChange();
  }

  return (
    <div className="panel">
      <h2>
        Compuerta humana{" "}
        <span className={`badge ${pending ? "real" : "mock"}`}>
          {pending ? "activa" : "inactiva"}
        </span>
      </h2>
      <div className="gate-box">
        <div className="gate-title">Compuerta: {gate?.gate ?? "enmarcar"}</div>
        <div className="meta">
          {pending
            ? "Aprobar el problema enmarcado sube la spec de versión (commit + historial). Iterar re-corre el agente con tu feedback."
            : "No hay propuesta pendiente. Corré el Agente 1 (orchestrator run) para generar una v+1."}
        </div>
        {pending && blockingFail && (
          <div className="meta error" style={{ marginTop: 6 }}>
            Hay criterios bloqueantes sin pasar: la aprobación está bloqueada.
          </div>
        )}
        <div className="gate-actions">
          <button
            className="gate approve"
            disabled={!pending || blockingFail}
            style={{
              cursor: pending && !blockingFail ? "pointer" : "not-allowed",
            }}
            onClick={approve}
          >
            Aprobar
          </button>
          <button
            className="gate iterate"
            disabled={!pending}
            style={{ cursor: pending ? "pointer" : "not-allowed" }}
            onClick={iterate}
          >
            Iterar
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="empty">Vacío.</p>;
}

function PipelinePanel({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="panel">
      <h2>Pipeline (7 etapas)</h2>
      {stages.map((s) => (
        <div className="stage" key={s.id}>
          <span className="num">{s.n}</span>
          <div>
            <div className="name">
              {s.name}{" "}
              <span className={`badge ${s.real ? "real" : "mock"}`}>
                {s.real ? "real" : "mock"}
              </span>
            </div>
            <div className="meta">
              {s.diamante} · {s.modo}
            </div>
          </div>
          {s.gate && <span className="gate-tag">gate: {s.gate}</span>}
        </div>
      ))}
    </div>
  );
}

function AuditPanel({ entries }: { entries: AuditEntry[] }) {
  const recent = [...entries].reverse();
  return (
    <div className="panel">
      <h2>
        Log de auditoría <span className="badge real">{entries.length}</span>
      </h2>
      {entries.length === 0 ? (
        <p className="empty">Sin entradas todavía.</p>
      ) : (
        recent.map((e, i) => (
          <div className="audit-entry" key={i}>
            <span className="who">{e.actor}</span>{" "}
            <span className="what">{e.action}</span>
            {e.target ? ` · ${e.target}` : ""}
            {e.reason ? ` — ${e.reason}` : ""}
            <div className="when">{e.timestamp}</div>
          </div>
        ))
      )}
    </div>
  );
}
