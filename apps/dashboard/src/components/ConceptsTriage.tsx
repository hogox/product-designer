// Triage de conceptos de solución (Exploración, F3-A): seleccionar / descartar / reabrir.
// `descartado` exige nota (invariante 7). Cada concepto muestra JTBD que aborda.
// Al cerrar la etapa (P4) los seleccionados se promueven a la spec y la vista pasa a
// solo-lectura ("Exploración cerrada"); el panel de cierre verifica antes de permitirlo.

import { useEffect, useState } from "react";
import { CheckCircle2, Lightbulb, LockKeyhole, Shapes, XCircle } from "lucide-react";

import type { Concept, Job, Stage } from "@pda/spec";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  reviewConcept,
  closeExploration,
  getExplorationVerification,
  type ConceptReviewStatus,
  type GateCriterion,
} from "../api";
import { actorLabel, useSession } from "../session";
import { ReviewCommentModal } from "./ReviewCommentModal";
import { ConceptReviewStatusBadge } from "./badges";

type FilterVal = "todos" | ConceptReviewStatus;
const FILTERS: FilterVal[] = ["todos", "propuesto", "seleccionado", "descartado"];

export function ConceptsTriage({
  specId,
  concepts,
  jobs,
  stage,
  promoted,
  onChange,
}: {
  specId: string | null;
  concepts: Concept[];
  jobs: Job[];
  stage: Stage | null;
  promoted: Concept[];
  onChange: () => void;
}) {
  const { user } = useSession();
  const [filter, setFilter] = useState<FilterVal>("todos");
  const [modal, setModal] = useState<{ cid: string; action: "discard" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const jobMap = new Map(jobs.map((j) => [j.id, j.statement]));

  // Cerrada (P4): no quedan conceptos de trabajo y hay seleccionados promovidos en la spec.
  const isClosed = concepts.length === 0 && promoted.length > 0;

  const visible =
    filter === "todos" ? concepts : concepts.filter((c) => c.review_status === filter);

  const counts: Record<FilterVal, number> = {
    todos: concepts.length,
    propuesto: concepts.filter((c) => c.review_status === "propuesto").length,
    seleccionado: concepts.filter((c) => c.review_status === "seleccionado").length,
    descartado: concepts.filter((c) => c.review_status === "descartado").length,
  };

  async function doReview(cid: string, status: ConceptReviewStatus, note?: string) {
    if (!specId) return;
    setBusy(cid);
    try {
      await reviewConcept(specId, cid, {
        status,
        note,
        by: actorLabel(user),
      });
      onChange();
    } finally {
      setBusy(null);
    }
  }

  if (isClosed) {
    return <ClosedConceptsView promoted={promoted} jobMap={jobMap} stage={stage} />;
  }

  if (concepts.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Shapes className="mx-auto mb-3 size-8 opacity-30" />
          <p>Sin conceptos todavía.</p>
          <p className="mt-1 font-mono text-xs">
            orchestrator explore {specId ?? "‹specId›"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "todos" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 tabular-nums text-xs opacity-70">
              {counts[f]}
            </span>
          </Button>
        ))}
      </div>

      {/* cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((c) => (
          <Card key={c.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                <ConceptReviewStatusBadge status={c.review_status} />
              </div>
              <CardTitle className="text-base leading-snug">{c.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <p className="text-sm text-muted-foreground">{c.description}</p>

              {/* rationale */}
              <p className="text-xs text-muted-foreground italic">{c.rationale}</p>

              {/* JTBD chips */}
              <div className="flex flex-wrap gap-1.5">
                {c.addresses_jtbd.map((jid) => (
                  <span
                    key={jid}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                    title={jobMap.get(jid)}
                  >
                    <Lightbulb className="size-3" />
                    {jid}
                  </span>
                ))}
              </div>

              {/* review note if present */}
              {c.review_note && (
                <p className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                  {c.review_note}
                </p>
              )}

              {/* actions */}
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                {c.review_status !== "seleccionado" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === c.id}
                    onClick={() => doReview(c.id, "seleccionado")}
                  >
                    Seleccionar
                  </Button>
                )}
                {c.review_status !== "descartado" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === c.id}
                    onClick={() => setModal({ cid: c.id, action: "discard" })}
                  >
                    Descartar
                  </Button>
                )}
                {c.review_status !== "propuesto" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === c.id}
                    onClick={() => doReview(c.id, "propuesto")}
                  >
                    Reabrir
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* panel de cierre de etapa */}
      <ExplorationClosePanel
        specId={specId}
        selectedCount={counts.seleccionado}
        onClosed={onChange}
      />

      {/* modal nota de descarte */}
      {modal && (
        <ReviewCommentModal
          findingId={modal.cid}
          action="rechazado"
          onSubmit={(note) => {
            void doReview(modal.cid, "descartado", note);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

/** Vista de solo lectura tras cerrar la etapa: los conceptos promovidos viven en la spec. */
function ClosedConceptsView({
  promoted,
  jobMap,
  stage,
}: {
  promoted: Concept[];
  jobMap: Map<string, string>;
  stage: Stage | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <LockKeyhole className="size-4 shrink-0" />
        <span>
          <strong>Exploración cerrada.</strong> {promoted.length} concepto
          {promoted.length === 1 ? "" : "s"} promovido
          {promoted.length === 1 ? "" : "s"} a la spec
          {stage ? ` · etapa actual: ${stage}` : ""}.
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {promoted.map((c) => (
          <Card key={c.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                <ConceptReviewStatusBadge status="seleccionado" />
              </div>
              <CardTitle className="text-base leading-snug">{c.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <p className="text-sm text-muted-foreground">{c.description}</p>
              <p className="text-xs text-muted-foreground italic">{c.rationale}</p>
              <div className="flex flex-wrap gap-1.5">
                {c.addresses_jtbd.map((jid) => (
                  <span
                    key={jid}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                    title={jobMap.get(jid)}
                  >
                    <Lightbulb className="size-3" />
                    {jid}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Panel de cierre de Exploración: verifica el triage y, si pasa, promueve los seleccionados. */
function ExplorationClosePanel({
  specId,
  selectedCount,
  onClosed,
}: {
  specId: string | null;
  selectedCount: number;
  onClosed: () => void;
}) {
  const { user } = useSession();
  const [criteria, setCriteria] = useState<GateCriterion[]>([]);
  const [dialog, setDialog] = useState(false);
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!specId) return;
    getExplorationVerification(specId)
      .then(setCriteria)
      .catch(() => setCriteria([]));
  }, [specId, selectedCount]);

  const blocked = criteria.some((c) => c.blocking && c.status !== "pass");

  async function close() {
    if (!specId) return;
    setBusy(true);
    setError(null);
    const res = await closeExploration(specId, {
      rationale,
      by: actorLabel(user),
    });
    setBusy(false);
    if (res.ok) {
      setDialog(false);
      setRationale("");
      onClosed();
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Error al cerrar");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LockKeyhole className="size-4 text-muted-foreground" />
          Cerrar Exploración
          {blocked ? (
            <Badge variant="pendiente">bloqueado</Badge>
          ) : (
            <Badge variant="aprobado">listo</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Promueve los conceptos seleccionados a la spec como decisión de diseño y avanza la
          etapa. No sube versión (no es una compuerta).
        </p>
        <ul className="space-y-1.5 text-sm">
          {criteria.map((c) => (
            <li key={c.criterion} className="flex items-start gap-2">
              {c.status === "pass" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
              )}
              <span>
                {c.criterion}
                {c.evidence && (
                  <span className="text-muted-foreground"> — {c.evidence}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <Button
          disabled={blocked || !specId}
          onClick={() => setDialog(true)}
        >
          Cerrar Exploración
        </Button>
      </CardContent>

      <Dialog open={dialog} onOpenChange={(o) => !o && setDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar Exploración</DialogTitle>
            <DialogDescription>
              Se promueven {selectedCount} concepto{selectedCount === 1 ? "" : "s"}{" "}
              seleccionado{selectedCount === 1 ? "" : "s"} a la spec y se registra una decisión
              con tu rationale. Avanza la etapa a Diseño.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="close-rationale">
              Rationale (por qué estos conceptos)
            </Label>
            <Textarea
              id="close-rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Ej.: C-001 ataca el job principal con menor costo de implementación…"
              rows={3}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button disabled={!rationale.trim() || busy} onClick={() => void close()}>
              Confirmar cierre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
