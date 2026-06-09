import { Link } from "react-router-dom";

import { useShell } from "../App";
import { SpecOverview } from "../components/SpecOverview";
import { AuditPanel } from "../components/AuditPanel";
import { STAGES } from "../stages";

export function OverviewPage() {
  const { spec, audit, state } = useShell();

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
              Hay una <strong>propuesta pendiente</strong> de compuerta — entrá
              a la etapa de Definición.
            </div>
          )}
          {STAGES.map((s) => (
            <Link key={s.id} to={`/etapa/${s.id}`} className="stage">
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
