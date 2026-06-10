// Triage de hallazgos (D2 · W2.4): revisión humana por ítem — aprobar / rechazar / pausar
// (las dos últimas exigen comentario). Estado visible (badge semántico + tooltip), filtros
// por estado y contadores. No-destructivo y auditado: usa PATCH …/findings/:fid/review.

import { useState } from "react";
import type { Finding } from "@pda/spec";

import { reviewFinding, type ReviewStatus } from "../api";
import { ReviewCommentModal } from "./ReviewCommentModal";

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  en_pausa: "En pausa",
};

const FILTERS: ("todos" | ReviewStatus)[] = [
  "todos",
  "pendiente",
  "aprobado",
  "en_pausa",
  "rechazado",
];

export function FindingsTriage({
  specId,
  findings,
  onChange,
}: {
  specId: string | null;
  findings: Finding[];
  onChange: () => void;
}) {
  const [filter, setFilter] = useState<"todos" | ReviewStatus>("todos");
  const [modal, setModal] = useState<{
    fid: string;
    action: "rechazado" | "en_pausa";
  } | null>(null);

  const count = (s: ReviewStatus) =>
    findings.filter((f) => f.review_status === s).length;

  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const filtered = findings
    .filter((f) => filter === "todos" || f.review_status === filter)
    .sort((a, b) => (order[a.confidence] ?? 9) - (order[b.confidence] ?? 9));

  async function setStatus(fid: string, status: ReviewStatus, comment?: string) {
    if (!specId) return;
    const res = await reviewFinding(specId, fid, {
      status,
      comment,
      by: "Lead de diseño",
    });
    if (res.ok) {
      setModal(null);
      onChange();
    } else {
      alert((await res.json().catch(() => ({}))).error ?? "Error");
    }
  }

  if (findings.length === 0) {
    return (
      <div className="panel">
        <p className="empty">
          No hay hallazgos en el store. Corré Descubrimiento (
          <code>orchestrator discover</code>).
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>
        Triage de hallazgos <span className="badge real">{findings.length}</span>
      </h2>
      <div className="triage-counts">
        {findings.length} hallazgos · {count("aprobado")} aprobados ·{" "}
        {count("pendiente")} pendientes · {count("en_pausa")} en pausa ·{" "}
        {count("rechazado")} rechazados
      </div>

      <div className="triage-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`chip${filter === f ? " active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "todos" ? "Todos" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="empty">Ningún hallazgo en este estado.</p>
      )}

      {filtered.map((f) => (
        <FindingCard
          key={f.id}
          finding={f}
          onApprove={() => setStatus(f.id, "aprobado")}
          onReject={() => setModal({ fid: f.id, action: "rechazado" })}
          onPause={() => setModal({ fid: f.id, action: "en_pausa" })}
          onResume={() => setStatus(f.id, "pendiente")}
        />
      ))}

      {modal && (
        <ReviewCommentModal
          findingId={modal.fid}
          action={modal.action}
          onClose={() => setModal(null)}
          onSubmit={(comment) => setStatus(modal.fid, modal.action, comment)}
        />
      )}
    </div>
  );
}

function FindingCard({
  finding: f,
  onApprove,
  onReject,
  onPause,
  onResume,
}: {
  finding: Finding;
  onApprove: () => void;
  onReject: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const reviewedTip = f.reviewed_by
    ? `${STATUS_LABEL[f.review_status]} por ${f.reviewed_by}${f.reviewed_at ? ` · ${new Date(f.reviewed_at).toLocaleString()}` : ""}${f.review_note ? `\n"${f.review_note}"` : ""}`
    : "Sin revisar";

  return (
    <div
      className="stage"
      style={{ alignItems: "flex-start", flexDirection: "column" }}
    >
      <div
        style={{ display: "flex", gap: 8, width: "100%", alignItems: "center" }}
      >
        <span className={`badge ${f.confidence === "high" ? "real" : "mock"}`}>
          {f.confidence}
        </span>
        <strong style={{ fontSize: 14, flex: 1 }}>{f.statement}</strong>
        <span
          className={`badge review-${f.review_status}`}
          title={reviewedTip}
        >
          {STATUS_LABEL[f.review_status]}
        </span>
      </div>
      <div className="meta" style={{ marginTop: 4 }}>
        {f.id} · {f.type} · →{f.feeds}
        {f.review_note ? ` · “${f.review_note}”` : ""}
      </div>
      {f.evidence.map((e, i) => (
        <div key={i} className="meta" style={{ paddingLeft: 8 }}>
          └ {e.source} · {e.locator}: {e.quote ? `"${e.quote}"` : e.computation}
        </div>
      ))}
      <div className="triage-actions">
        <button
          type="button"
          className="gate approve"
          style={{ cursor: "pointer", padding: "3px 12px" }}
          disabled={f.review_status === "aprobado"}
          onClick={onApprove}
        >
          Aprobar
        </button>
        <button
          type="button"
          className="gate iterate"
          style={{ cursor: "pointer", padding: "3px 12px" }}
          disabled={f.review_status === "en_pausa"}
          onClick={onPause}
        >
          Pausar
        </button>
        <button
          type="button"
          className="gate reject"
          style={{ cursor: "pointer", padding: "3px 12px" }}
          disabled={f.review_status === "rechazado"}
          onClick={onReject}
        >
          Rechazar
        </button>
        {f.review_status !== "pendiente" && (
          <button
            type="button"
            className="link-button"
            onClick={onResume}
            title="Volver a pendiente"
          >
            Reabrir
          </button>
        )}
      </div>
    </div>
  );
}
