// Triage de conceptos de solución (Exploración, F3-A): seleccionar / descartar / reabrir.
// `descartado` exige nota (invariante 7). Cada concepto muestra JTBD que aborda.

import { useState } from "react";
import { Lightbulb, Shapes } from "lucide-react";

import type { Concept, Job } from "@pda/spec";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { reviewConcept, type ConceptReviewStatus } from "../api";
import { actorLabel, useSession } from "../session";
import { ReviewCommentModal } from "./ReviewCommentModal";
import { ConceptReviewStatusBadge } from "./badges";

type FilterVal = "todos" | ConceptReviewStatus;
const FILTERS: FilterVal[] = ["todos", "propuesto", "seleccionado", "descartado"];

export function ConceptsTriage({
  specId,
  concepts,
  jobs,
  onChange,
}: {
  specId: string | null;
  concepts: Concept[];
  jobs: Job[];
  onChange: () => void;
}) {
  const { user } = useSession();
  const [filter, setFilter] = useState<FilterVal>("todos");
  const [modal, setModal] = useState<{ cid: string; action: "discard" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const jobMap = new Map(jobs.map((j) => [j.id, j.statement]));

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
