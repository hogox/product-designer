import type { Spec } from "@pda/spec";

export function Metrics({ shown }: { shown: Spec }) {
  return (
    <div className="panel">
      <h2>
        Métricas (HEART / GSM){" "}
        <span className="badge real">{shown.outcomes.length}</span>
      </h2>
      <div className="meta" style={{ marginBottom: 8 }}>
        Baseline computado desde la evidencia; el target lo fija el humano en la
        compuerta.
      </div>
      {shown.outcomes.length === 0 ? (
        <p className="empty">Aún sin métricas.</p>
      ) : (
        shown.outcomes.map((o, i) => (
          <div className="section" key={i}>
            <div>
              {o.heart && <span className="badge mock">{o.heart}</span>}{" "}
              <strong>{o.metric}</strong>
            </div>
            <div className="meta">
              baseline: {o.baseline ?? "—"} → target: {o.target} ({o.method})
            </div>
            {o.signals && o.signals.length > 0 && (
              <div className="meta">señales: {o.signals.join("; ")}</div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
