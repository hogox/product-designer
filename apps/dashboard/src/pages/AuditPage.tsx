import { useShell } from "../App";

export function AuditPage() {
  const { audit } = useShell();
  const recent = [...audit].reverse();
  return (
    <div className="panel">
      <h2>
        Log de auditoría <span className="badge real">{audit.length}</span>
      </h2>
      {audit.length === 0 ? (
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
