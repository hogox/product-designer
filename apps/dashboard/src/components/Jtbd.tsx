import type { Spec } from "@pda/spec";

export function Jtbd({
  shown,
  isProposal,
}: {
  shown: Spec;
  isProposal: boolean;
}) {
  return (
    <div className="panel">
      <h2>
        JTBD — Jobs To Be Done{" "}
        <span className={`badge ${isProposal ? "real" : "real"}`}>
          {shown.jtbd.length}
        </span>
      </h2>
      <div className="meta" style={{ marginBottom: 8 }}>
        Cada job se ancla a los hallazgos que lo motivan (procedencia heredada).
      </div>
      {shown.jtbd.length === 0 ? (
        <p className="empty">Aún sin JTBD (corré Definición).</p>
      ) : (
        shown.jtbd.map((j) => (
          <div className="section" key={j.id}>
            <div>{j.statement}</div>
            <div className="meta">
              {j.id} ← sustentado por: {j.supported_by.join(", ")}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
