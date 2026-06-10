// Modal de comentario obligatorio (D2 · W2.4): rechazar o pausar un hallazgo exige un
// motivo (extiende invariante 7). Una decisión por modal.

import { useEffect, useState } from "react";

export function ReviewCommentModal({
  findingId,
  action,
  onSubmit,
  onClose,
}: {
  findingId: string;
  action: "rechazado" | "en_pausa";
  onSubmit: (comment: string) => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const verb = action === "rechazado" ? "Rechazar" : "Pausar";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (comment.trim()) onSubmit(comment.trim());
        }}
      >
        <h2>
          {verb} {findingId}
        </h2>
        <label htmlFor="review-comment">
          Motivo (obligatorio — queda en el log de auditoría)
        </label>
        <textarea
          id="review-comment"
          autoFocus
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            action === "rechazado"
              ? "La cita no respalda la afirmación…"
              : "Necesito validar con analítica antes de decidir…"
          }
        />
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary" disabled={!comment.trim()}>
            {verb}
          </button>
        </div>
      </form>
    </div>
  );
}
