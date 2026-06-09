import type { AuditEntry } from "@pda/spec";

export function AuditPanel({
  entries,
  limit,
  title = "Log de auditoría",
}: {
  entries: AuditEntry[];
  limit?: number;
  title?: string;
}) {
  const recent = [...entries].reverse().slice(0, limit ?? entries.length);
  return (
    <div className="panel">
      <h2>
        {title} <span className="badge real">{entries.length}</span>
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
