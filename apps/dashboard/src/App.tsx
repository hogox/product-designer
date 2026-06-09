import { useEffect, useState } from "react";
import type { Spec, AuditEntry } from "@pda/spec";

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

export function App() {
  const [specId, setSpecId] = useState<string | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<string[]>("/api/specs")
      .then((ids) => setSpecId(ids[0] ?? null))
      .catch((e) => setError(String(e)));
    getJson<PipelineStage[]>("/api/pipeline")
      .then(setPipeline)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!specId) return;
    getJson<Spec>(`/api/spec/${specId}`)
      .then(setSpec)
      .catch((e) => setError(String(e)));
    getJson<AuditEntry[]>(`/api/audit/${specId}`)
      .then(setAudit)
      .catch(() => setAudit([]));
  }, [specId]);

  const enmarcar = pipeline.find((s) => s.gate === "enmarcar");

  return (
    <>
      <header className="app-header">
        <div>
          <h1>Product Designer Agéntico</h1>
          <div className="sub">
            Dashboard centrado en la spec · Fase 0 (shell) — el agente propone,
            el humano aprueba
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
          <SpecViewer spec={spec} />
        </div>
        <div>
          <PipelinePanel stages={pipeline} />
          <GatePanel gate={enmarcar} />
          <AuditPanel entries={audit} />
        </div>
      </div>
    </>
  );
}

function SpecViewer({ spec }: { spec: Spec | null }) {
  if (!spec) {
    return (
      <div className="panel">
        <h2>Spec</h2>
        <p className="empty">Cargando spec…</p>
      </div>
    );
  }
  return (
    <div className="panel">
      <h2>
        Spec <span className="badge real">real</span>
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
          <div>{spec.problem_statement}</div>
        </Section>
      )}

      <Section title="1 · Outcomes">
        {spec.outcomes.length === 0 ? (
          <Empty />
        ) : (
          <ul className="tight">
            {spec.outcomes.map((o, i) => (
              <li key={i}>
                <strong>{o.metric}</strong>: {o.baseline ?? "—"} → {o.target}{" "}
                <span className="meta">({o.method})</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="2 · Alcance">
        <div>
          <em>In-scope:</em>{" "}
          {spec.scope.in_scope.length ? spec.scope.in_scope.join(", ") : "—"}
        </div>
        <div>
          <em>Non-goals:</em>{" "}
          {spec.scope.non_goals.length ? spec.scope.non_goals.join(", ") : "—"}
        </div>
      </Section>

      <Section title="3 · Restricciones">
        <div>
          <em>Regulatorias:</em>{" "}
          {spec.constraints.regulatory.length
            ? spec.constraints.regulatory.join(", ")
            : "—"}
        </div>
        <div>
          <em>Accesibilidad:</em> {spec.constraints.accessibility || "—"}
        </div>
        <div>
          <em>Design system:</em> {spec.constraints.design_system.name || "—"}
        </div>
        <div>
          <em>Técnicas:</em>{" "}
          {spec.constraints.technical.length
            ? spec.constraints.technical.join(", ")
            : "—"}
        </div>
      </Section>

      <Section title="4 · Decisiones previas">
        {spec.decisions.length === 0 ? (
          <Empty />
        ) : (
          <ul className="tight">
            {spec.decisions.map((d) => (
              <li key={d.id}>
                <strong>{d.decision}</strong> — {d.rationale}{" "}
                <span className="meta">({d.author})</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="5 · Tareas">
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

      <Section title="6 · Criterios de verificación">
        {spec.verification.length === 0 ? (
          <Empty />
        ) : (
          <ul className="tight">
            {spec.verification.map((v, i) => (
              <li key={i}>
                [{v.status}] {v.criterion}{" "}
                <span className="meta">
                  ({v.type}
                  {v.blocking ? ", bloqueante" : ""})
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Hallazgos (findings)">
        {spec.findings.length === 0 ? (
          <p className="empty">
            Se poblará en Descubrimiento (Agente 1, Fase 1): cada hallazgo
            anclado a su cita o cálculo.
          </p>
        ) : (
          <ul className="tight">
            {spec.findings.map((f) => (
              <li key={f.id}>
                <strong>{f.statement}</strong>{" "}
                <span className="meta">
                  ({f.type}, {f.confidence}, {f.status})
                </span>
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
  return <p className="empty">Vacío en v0.</p>;
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

function GatePanel({ gate }: { gate: PipelineStage | undefined }) {
  return (
    <div className="panel">
      <h2>
        Compuerta humana <span className="badge mock">mock</span>
      </h2>
      <div className="gate-box">
        <div className="gate-title">
          {gate ? `Compuerta: ${gate.gate}` : "Compuerta: enmarcar"}
        </div>
        <div className="meta">
          El agente <strong>propone</strong> una nueva versión de la spec; un
          humano la <strong>aprueba</strong> o pide iterar. Las compuertas nunca
          se automatizan (invariante 2).
        </div>
        <div className="gate-actions">
          <button className="gate approve" disabled title="Se cablea en 1.8">
            Aprobar
          </button>
          <button className="gate iterate" disabled title="Se cablea en 1.8">
            Iterar
          </button>
        </div>
        <div className="meta" style={{ marginTop: 8 }}>
          Mockeado en Fase 0 — la lógica de aprobación (version++ + commit +
          historial) llega en el paso 1.8.
        </div>
      </div>
    </div>
  );
}

function AuditPanel({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="panel">
      <h2>
        Log de auditoría <span className="badge real">real</span>
      </h2>
      {entries.length === 0 ? (
        <p className="empty">Sin entradas todavía.</p>
      ) : (
        entries.map((e, i) => (
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
