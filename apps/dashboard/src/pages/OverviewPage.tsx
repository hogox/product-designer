import { Link } from "react-router-dom";

import { useShell } from "../App";
import { SpecOverview } from "../components/SpecOverview";
import { AuditPanel } from "../components/AuditPanel";
import { STAGES } from "../stages";
import { specPath } from "../nav";

export function OverviewPage() {
  const { specId, spec, audit, state } = useShell();

  if (!spec) {
    return (
      <div className="panel">
        <p className="empty">Cargando spec…</p>
      </div>
    );
  }

  return (
    <div className="layout">
      <SpecOverview spec={spec} />
      <div>
        <div className="panel">
          <h2>Pipeline</h2>
          {state?.hasProposal && (
            <div className="meta" style={{ marginBottom: 8 }}>
              Hay una <strong>propuesta pendiente</strong> de compuerta —{" "}
              <Link to={specPath(specId, "/etapa/definicion/compuerta")}>
                entrá a la etapa de Definición
              </Link>
              .
            </div>
          )}
          {STAGES.map((s) => (
            <Link
              key={s.id}
              to={specPath(specId, `/etapa/${s.id}`)}
              className="stage"
            >
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
            </Link>
          ))}
        </div>
        <AuditPanel entries={audit} limit={6} title="Auditoría reciente" />
      </div>
    </div>
  );
}
