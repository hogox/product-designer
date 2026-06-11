// Triage de hallazgos (D2 · W2.4): revisión humana por ítem — aprobar / rechazar / pausar
// (las dos últimas exigen comentario). Estado visible (badge semántico + tooltip), filtros
// por estado y contadores. No-destructivo y auditado: usa PATCH …/findings/:fid/review.
// W3.2: Card modular; la evidencia anclada sube de jerarquía (cita a text-sm, locator chip).

import { useState } from "react";
import { ChevronRight, ClipboardCheck } from "lucide-react";

import type { Finding, Job } from "@pda/spec";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { reviewFinding, type ReviewStatus } from "../api";
import { actorLabel, useSession } from "../session";
import { ReviewCommentModal } from "./ReviewCommentModal";
import { FindingDrawer } from "./FindingDrawer";
import {
  ConfidenceBadge,
  FindingTypeBadge,
  RealMockBadge,
  ReviewStatusBadge,
  REVIEW_LABEL,
} from "./badges";
import { SectionIcon } from "./icons";

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
  jtbd,
  onChange,
}: {
  specId: string | null;
  findings: Finding[];
  jtbd: Job[];
  onChange: () => void;
}) {
  const { user } = useSession();
  const [filter, setFilter] = useState<"todos" | ReviewStatus>("todos");
  const [modal, setModal] = useState<{
    fid: string;
    action: "rechazado" | "en_pausa";
  } | null>(null);
  // Guardamos el id (no el objeto): tras un refetch, el drawer refleja el estado nuevo.
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = findings.find((f) => f.id === detailId) ?? null;

  const count = (s: ReviewStatus) =>
    findings.filter((f) => f.review_status === s).length;

  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const filtered = findings
    .filter((f) => filter === "todos" || f.review_status === filter)
    .sort((a, b) => (order[a.confidence] ?? 9) - (order[b.confidence] ?? 9));

  async function setStatus(
    fid: string,
    status: ReviewStatus,
    comment?: string,
  ) {
    if (!specId) return;
    const res = await reviewFinding(specId, fid, {
      status,
      comment,
      by: actorLabel(user),
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
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            Sin hallazgos todavía. Usá el botón{" "}
            <strong>Correr Descubrimiento</strong> de arriba para que el Agente 1
            los proponga desde las fuentes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <SectionIcon icon={ClipboardCheck} tone="primary" />
          Triage de hallazgos
          <RealMockBadge real />
          <Badge variant="secondary">{findings.length}</Badge>
        </CardTitle>
        <CardDescription>
          {findings.length} hallazgos · {count("aprobado")} aprobados ·{" "}
          {count("pendiente")} pendientes · {count("en_pausa")} en pausa ·{" "}
          {count("rechazado")} rechazados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={filter === f ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setFilter(f)}
            >
              {f === "todos" ? "Todos" : REVIEW_LABEL[f]}
            </Button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            Ningún hallazgo en este estado.
          </p>
        )}

        {filtered.map((f) => (
          <FindingCard
            key={f.id}
            finding={f}
            onOpen={() => setDetailId(f.id)}
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

        <FindingDrawer
          finding={detail}
          jtbd={jtbd}
          open={detailId !== null}
          onOpenChange={(o) => !o && setDetailId(null)}
        />
      </CardContent>
    </Card>
  );
}

function FindingCard({
  finding: f,
  onOpen,
  onApprove,
  onReject,
  onPause,
  onResume,
}: {
  finding: Finding;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const reviewedTip = f.reviewed_by
    ? `${REVIEW_LABEL[f.review_status]} por ${f.reviewed_by}${f.reviewed_at ? ` · ${new Date(f.reviewed_at).toLocaleString()}` : ""}${f.review_note ? `\n"${f.review_note}"` : ""}`
    : "Sin revisar";

  return (
    <div className="space-y-3 rounded-lg border p-4">
      {/* Zona clickeable: abre el drawer con la cadena de evidencia completa (W4.1).
          La tarjeta queda compacta — título + badges + acciones. */}
      <button
        type="button"
        onClick={onOpen}
        className="-m-1 block w-full rounded-md p-1 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex flex-wrap items-start gap-2">
          <ConfidenceBadge confidence={f.confidence} />
          <FindingTypeBadge type={f.type} />
          <span className="min-w-40 flex-1 text-sm font-medium">
            {f.statement}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <ReviewStatusBadge status={f.review_status} />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm whitespace-pre-line">
              {reviewedTip}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {f.id} · →{f.feeds} · {f.evidence.length} evidencia
          {f.evidence.length === 1 ? "" : "s"}
          <span className="flex items-center text-primary">
            Ver detalle <ChevronRight className="size-3" />
          </span>
        </div>
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          disabled={f.review_status === "aprobado"}
          onClick={onApprove}
        >
          Aprobar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
          disabled={f.review_status === "en_pausa"}
          onClick={onPause}
        >
          Pausar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          disabled={f.review_status === "rechazado"}
          onClick={onReject}
        >
          Rechazar
        </Button>
        {f.review_status !== "pendiente" && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            title="Volver a pendiente"
            onClick={onResume}
          >
            Reabrir
          </Button>
        )}
      </div>
    </div>
  );
}
