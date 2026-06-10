// Panel de verificación: lista criterios con su estado pass/fail. Sirve tanto para los
// criterios de Descubrimiento (cliente) como para los de la propuesta (VerificationCriterion).

export interface Criterion {
  criterion: string;
  status: string; // "pass" | "fail" | "pending"
  evidence: string | null;
  blocking?: boolean; // si es false, un fail es advertencia (no bloquea la compuerta)
}

export function VerificationPanel({
  criteria,
  title = "Verificación automatizada",
}: {
  criteria: Criterion[];
  title?: string;
}) {
  if (criteria.length === 0) {
    return (
      <div className="panel">
        <p className="empty">Sin criterios de verificación todavía.</p>
      </div>
    );
  }
  return (
    <div className="panel">
      <h2>{title}</h2>
      {criteria.map((c, i) => {
        // fail no bloqueante = advertencia (ámbar), no un ✗ rojo de bloqueo
        const warning = c.status === "fail" && c.blocking === false;
        const cls = c.status === "pass" ? "real" : warning ? "mock" : "danger";
        const glyph =
          c.status === "pass"
            ? "✓"
            : c.status === "fail"
              ? warning
                ? "⚠"
                : "✗"
              : "·";
        return (
          <div key={i} className="meta" style={{ marginBottom: 4 }}>
            <span className={`badge ${cls}`}>{glyph}</span> {c.criterion}
            {warning ? " (advertencia)" : ""}
            {c.evidence ? ` — ${c.evidence}` : ""}
          </div>
        );
      })}
    </div>
  );
}
