// Panel de verificación: lista criterios con su estado pass/fail. Sirve tanto para los
// criterios de Descubrimiento (cliente) como para los de la propuesta (VerificationCriterion).

export interface Criterion {
  criterion: string;
  status: string; // "pass" | "fail" | "pending"
  evidence: string | null;
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
      {criteria.map((c, i) => (
        <div key={i} className="meta" style={{ marginBottom: 4 }}>
          <span className={`badge ${c.status === "pass" ? "real" : "mock"}`}>
            {c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "·"}
          </span>{" "}
          {c.criterion}
          {c.evidence ? ` — ${c.evidence}` : ""}
        </div>
      ))}
    </div>
  );
}
