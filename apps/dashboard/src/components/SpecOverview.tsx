// Vista holística de la spec viva (la fuente de verdad). Reusada en el overview.

import type { Spec } from "@pda/spec";

import { Section, Empty } from "./Section";

export function SpecOverview({ spec }: { spec: Spec }) {
  return (
    <div className="panel">
      <h2>
        Spec viva <span className="badge real">real</span>
      </h2>
      <div className="spec-meta">
        <span className="pill">id: {spec.id}</span>
        <span className="pill">v{spec.version}</span>
        <span className="pill">{spec.status}</span>
        <span className="pill">etapa: {spec.current_stage}</span>
      </div>
      <div className="spec-title">{spec.title}</div>

      {spec.problem_statement && (
        <Section title="Problem statement (Definición)">
          <div>{spec.problem_statement}</div>
        </Section>
      )}

      <Section title="Outcomes / métricas">
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

      <Section title="Alcance">
        <div>
          <em>In-scope:</em>{" "}
          {spec.scope.in_scope.length ? spec.scope.in_scope.join("; ") : "—"}
        </div>
        <div>
          <em>Non-goals:</em>{" "}
          {spec.scope.non_goals.length ? spec.scope.non_goals.join("; ") : "—"}
        </div>
      </Section>

      <Section title="Tareas (hipótesis)">
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
