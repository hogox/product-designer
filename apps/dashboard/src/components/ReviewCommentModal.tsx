// Modal de comentario obligatorio (D2 · W2.4): rechazar o pausar un hallazgo exige un
// motivo (extiende invariante 7). Una decisión por modal.
// W4.2: Dialog stock (foco atrapado + Esc); cero CSS legado.

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  const verb = action === "rechazado" ? "Rechazar" : "Pausar";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {verb} {findingId}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (comment.trim()) onSubmit(comment.trim());
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="review-comment">
              Motivo (obligatorio — queda en el log de auditoría)
            </Label>
            <Textarea
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
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!comment.trim()}>
              {verb}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
