// Home "Mis specs" (D2 · W0.4): specs agrupadas por producto, sin spec activa (sin sidebar
// de etapas). Punto de entrada del dashboard multi-spec.
// Rediseño: barra superior con marca + cuenta; grupos de producto como secciones con
// conteo + separador; SpecCard con grilla fija (icono de etapa + estado + mini-pipeline +
// footer con id/última actividad). El mini-pipeline da el ancla de orden que faltaba.

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Workflow } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSpecGroups, type SpecGroup, type SpecIndexEntry } from "../api";
import { AccountMenu } from "../components/AccountMenu";
import { SectionIcon, STAGE_ICON } from "../components/icons";
import { STAGES } from "../stages";
import { specPath } from "../nav";

export function SpecsHomePage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<SpecGroup[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSpecGroups()
      .then(setGroups)
      .catch((e) => setError(String(e)));
  }, []);

  const archivedCount = groups
    .flatMap((g) => g.specs)
    .filter((s) => s.status === "archivada").length;

  const visibleGroups = groups
    .map((g) => ({
      product: g.product,
      specs: g.specs.filter((s) => showArchived || s.status === "activa"),
    }))
    .filter((g) => g.specs.length > 0);

  return (
    <div className="min-h-screen">
      {/* barra superior: marca + cuenta (deja de flotar) */}
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <span className="text-sm font-bold text-foreground">
            Product Designer Agéntico
          </span>
          <div className="w-56">
            <AccountMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* header de página */}
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Mis specs</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Cada spec es un contrato versionado, con sus propias fuentes,
              hallazgos y auditoría.
            </p>
          </div>
          <Button onClick={() => navigate("/nueva")}>
            <Plus className="size-4" />
            Nueva spec
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/40 p-4 text-sm text-destructive">
            Error: {error}
          </Card>
        )}

        {!error && groups.length === 0 && (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground italic">
              Todavía no hay specs.
            </p>
          </Card>
        )}

        <div className="space-y-8">
          {visibleGroups.map((g) => (
            <section key={g.product}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {g.product}
                </h2>
                <Badge variant="secondary" className="tabular-nums">
                  {g.specs.length}
                </Badge>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.specs.map((s) => (
                  <SpecCard key={s.id} entry={s} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {archivedCount > 0 && (
          <button
            type="button"
            className="mt-8 text-sm text-primary underline-offset-4 hover:underline"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived
              ? "Ocultar archivadas"
              : `Ver archivadas (${archivedCount})`}
          </button>
        )}
      </div>
    </div>
  );
}

/** Relativo simple "hace X" desde un ISO timestamp (o "—" si no hay). */
function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "hace instantes";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} d`;
  const months = Math.round(days / 30);
  if (months < 12) return `hace ${months} mes${months === 1 ? "" : "es"}`;
  return `hace ${Math.round(months / 12)} a`;
}

/** Mini-pipeline de 7 segmentos: pasadas + actual rellenas, futuras vacías. */
function StagePipeline({ stageId }: { stageId: string }) {
  const idx = STAGES.findIndex((s) => s.id === stageId);
  return (
    <div className="flex gap-1" aria-hidden>
      {STAGES.map((s, i) => (
        <span
          key={s.id}
          className={`h-1.5 flex-1 rounded-full ${
            i < idx
              ? "bg-primary/40"
              : i === idx
                ? "bg-primary"
                : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

function SpecCard({ entry }: { entry: SpecIndexEntry }) {
  const archived = entry.status === "archivada";
  const stageIdx = STAGES.findIndex((s) => s.id === entry.stage);
  const stageDef = STAGES[stageIdx];
  const StageIcon = STAGE_ICON[entry.stage] ?? Workflow;

  return (
    <Link to={specPath(entry.id)} className="group">
      <Card
        className={`gap-0 p-4 transition-colors group-hover:border-primary/30 group-hover:bg-muted/50 ${
          archived ? "opacity-60" : ""
        }`}
      >
        {/* fila 1: icono de etapa + nombre + estado */}
        <div className="flex items-start gap-3">
          <SectionIcon
            icon={StageIcon}
            tone={archived ? "slate" : "primary"}
          />
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-sm leading-snug font-medium">
              {entry.name}
            </div>
          </div>
          <Badge variant={archived ? "mock" : "real"}>{entry.status}</Badge>
        </div>

        {/* fila 2: mini-pipeline + etiqueta de etapa */}
        <div className="mt-4 space-y-1.5">
          <StagePipeline stageId={entry.stage} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Etapa {stageIdx + 1}/{STAGES.length}
              {stageDef ? ` · ${stageDef.name}` : ""}
            </span>
            {entry.hasProposal && (
              <Badge variant="enPausa" className="text-[10px]">
                propuesta pendiente
              </Badge>
            )}
          </div>
        </div>

        {/* footer: id + última actividad */}
        <div className="mt-4 flex items-center justify-between border-t pt-3">
          <Badge variant="outline" className="font-mono text-[10px]">
            {entry.id}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {relativeTime(entry.updatedAt)}
          </span>
        </div>
      </Card>
    </Link>
  );
}
