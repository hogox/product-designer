// Triage de hallazgos (validación micro, invariante 7): lote para high-confidence, foco en
// low / alto impacto; rechazar pide motivo y queda en el log de auditoría.

import type { Finding } from "@pda/spec";

import { postJson } from "../api";

export function FindingsTriage({
  specId,
  findings,
  onChange,
}: {
  specId: string | null;
  findings: Finding[];
  onChange: () => void;
}) {
  // W2 (transición): los rechazados ya no se borran (quedan marcados + auditados); acá
  // se ocultan para preservar la UX actual. La UI plena de estados/filtros llega en W2.4.
  const visible = findings.filter((f) => f.review_status !== "rechazado");
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...visible].sort(
    (a, b) => (order[a.confidence] ?? 9) - (order[b.confidence] ?? 9),
  );
  const high = visible.filter((f) => f.confidence === "high").length;

  async function reject(f: Finding) {
    if (!specId) return;
    const reason = window.prompt(
      `Motivo del rechazo de ${f.id} (queda en el log de auditoría):`,
    );
    if (!reason) return;
    const res = await postJson(`/api/findings/${specId}/${f.id}/reject`, {
      reason,
      actor: "Lead de diseño",
    });
    if (res.ok) onChange();
  }

  if (visible.length === 0) {
    return (
      <div className="panel">
        <p className="empty">
          No hay hallazgos por revisar. Corré Descubrimiento (
          <code>orchestrator discover</code>).
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>
        Triage de hallazgos{" "}
        <span className="badge real">{visible.length}</span>
      </h2>
      <div className="meta" style={{ marginBottom: 10 }}>
        Validación micro (no es la compuerta): {high} en{" "}
        <strong>high confidence</strong> (lote) · foco en <strong>low</strong> y
        los de alto impacto. Rechazar pide motivo (invariante 7).
      </div>
      {sorted.map((f) => (
        <div
          key={f.id}
          className="stage"
          style={{ alignItems: "flex-start", flexDirection: "column" }}
        >
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <span
              className={`badge ${f.confidence === "high" ? "real" : "mock"}`}
            >
              {f.confidence}
            </span>
            <strong style={{ fontSize: 14, flex: 1 }}>{f.statement}</strong>
            <button
              className="gate iterate"
              style={{ cursor: "pointer", padding: "2px 10px" }}
              onClick={() => reject(f)}
            >
              Rechazar
            </button>
          </div>
          <div className="meta" style={{ marginTop: 4 }}>
            {f.id} · {f.type} · →{f.feeds}
          </div>
          {f.evidence.map((e, i) => (
            <div key={i} className="meta" style={{ paddingLeft: 8 }}>
              └ {e.source} · {e.locator}:{" "}
              {e.quote ? `"${e.quote}"` : e.computation}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
