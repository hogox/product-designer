// Compuerta humana (enmarcar): el agente propone, el humano aprueba. Nunca se automatiza.
// Aprobar sube versión (commit + historial); iterar registra feedback. Bloquea si la
// verificación tiene criterios bloqueantes sin pasar.
// W4.2c: la aprobación pasa por un Dialog de CONFIRMACIÓN (resumen de versión/conteos/
// criterios antes del commit) y el iterar por un Dialog de feedback — adiós window.prompt.

import { useState } from "react";
import { CheckCircle2, UserCheck, XCircle } from "lucide-react";

import type { Spec } from "@pda/spec";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionIcon } from "./icons";
import { postJson } from "../api";

export function GatePanel({
  specId,
  proposed,
  gateName = "enmarcar",
  onChange,
}: {
  specId: string | null;
  proposed: Spec | null;
  gateName?: string;
  onChange: () => void;
}) {
  const pending = proposed !== null;
  const blockingFail =
    proposed?.verification.some((c) => c.blocking && c.status !== "pass") ??
    false;
  const [dialog, setDialog] = useState<"approve" | "iterate" | null>(null);

  async function approve(approver: string) {
    if (!specId) return;
    const res = await postJson(`/api/gate/${specId}/approve`, { approver });
    if (res.ok) {
      setDialog(null);
      onChange();
    } else {
      alert((await res.json().catch(() => ({}))).error ?? "Error");
    }
  }

  async function iterate(feedback: string) {
    if (!specId) return;
    const res = await postJson(`/api/gate/${specId}/iterate`, {
      feedback,
      actor: "Lead de diseño",
    });
    if (res.ok) {
      setDialog(null);
      onChange();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <SectionIcon icon={UserCheck} tone="amber" />
          Compuerta humana
          {pending ? (
            <Badge variant="aprobado">activa</Badge>
          ) : (
            <Badge variant="secondary">inactiva</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-4">
          <div className="font-semibold">Compuerta: {gateName}</div>
          <p className="text-sm text-muted-foreground">
            {pending
              ? "Aprobar el problema enmarcado sube la spec de versión (commit + historial). Iterar re-corre el agente con tu feedback."
              : "No hay propuesta pendiente. Corré la etapa (orchestrator define) para generar una v+1."}
          </p>
          {pending && blockingFail && (
            <p className="text-sm text-destructive">
              Hay criterios bloqueantes sin pasar: la aprobación está bloqueada.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!pending || blockingFail}
              onClick={() => setDialog("approve")}
            >
              Aprobar
            </Button>
            <Button
              variant="outline"
              disabled={!pending}
              onClick={() => setDialog("iterate")}
            >
              Iterar
            </Button>
          </div>
        </div>
      </CardContent>

      {proposed && dialog === "approve" && (
        <GateApproveDialog
          proposed={proposed}
          gateName={gateName}
          onConfirm={approve}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "iterate" && (
        <GateIterateDialog
          onSubmit={iterate}
          onClose={() => setDialog(null)}
        />
      )}
    </Card>
  );
}

// Confirmación de compuerta (W4.2c): resumen de lo que se aprueba antes del commit.
function GateApproveDialog({
  proposed,
  gateName,
  onConfirm,
  onClose,
}: {
  proposed: Spec;
  gateName: string;
  onConfirm: (approver: string) => void;
  onClose: () => void;
}) {
  const [approver, setApprover] = useState("");
  const nextVersion = proposed.version + 1;
  const passed = proposed.verification.filter((c) => c.status === "pass").length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprobar compuerta «{gateName}»</DialogTitle>
          <DialogDescription>
            Esto sube la spec a <strong>v{nextVersion}</strong> (commit +
            entrada de historial). Revisá el resumen antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (approver.trim()) onConfirm(approver.trim());
          }}
        >
          <div className="grid grid-cols-3 gap-2 text-center">
            <Summary n={proposed.jtbd.length} label="JTBD" />
            <Summary n={proposed.outcomes.length} label="Métricas" />
            <Summary n={proposed.findings.length} label="Hallazgos" />
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Verificación ({passed}/{proposed.verification.length})
            </div>
            <ul className="space-y-1">
              {proposed.verification.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {c.status === "pass" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <span>{c.criterion}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="approver">Aprobás como (rol)</Label>
            <Input
              id="approver"
              autoFocus
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
              placeholder="Lead de diseño / PM"
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!approver.trim()}>
              Aprobar → v{nextVersion}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Summary({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-lg border bg-card p-2">
      <div className="text-xl font-semibold">{n}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function GateIterateDialog({
  onSubmit,
  onClose,
}: {
  onSubmit: (feedback: string) => void;
  onClose: () => void;
}) {
  const [feedback, setFeedback] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iterar la propuesta</DialogTitle>
          <DialogDescription>
            Tu feedback entra como input del agente y queda en el log de
            auditoría.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (feedback.trim()) onSubmit(feedback.trim());
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="gate-feedback">Feedback</Label>
            <Textarea
              id="gate-feedback"
              autoFocus
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="La métrica de adopción necesita un baseline computado…"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!feedback.trim()}>
              Iterar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
