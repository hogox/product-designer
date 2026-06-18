// Banda de flujo (D2 · evidencia input↔spec): hace explícito el modelo mental del producto
// en una sola fila — lo que VOS le das al sistema (Input + Fuentes) → el proceso (etapa
// actual del pipeline) → lo que el sistema CONSTRUYE (la spec viva, vN). Previene el
// malentendido de leer el input como si fuera la spec. Cada zona es un atajo de navegación.

import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList, FileStack, FolderOpen, Workflow } from "lucide-react";
import type { Spec } from "@pda/spec";

import { Badge } from "@/components/ui/badge";
import { specPath } from "../nav";
import { STAGES } from "../stages";

const chip =
  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors hover:border-primary/30 hover:bg-muted/50";

export function FlowBand({
  specId,
  spec,
}: {
  specId: string | null;
  spec: Spec;
}) {
  const stageIdx = STAGES.findIndex((s) => s.id === spec.current_stage);
  const stageName = STAGES[stageIdx]?.name ?? spec.current_stage;
  const hasInput = Boolean(spec.intake?.researchQuestion);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card p-3">
      {/* Entrada: lo que da el humano */}
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        Vos das
      </span>
      <Link to={specPath(specId, "/intake")} className={chip}>
        <ClipboardList className="size-4 text-muted-foreground" />
        <span className="font-medium">Input</span>
        {!hasInput && (
          <Badge variant="outline" className="text-[10px]">
            vacío
          </Badge>
        )}
      </Link>
      <Link to={specPath(specId, "/fuentes")} className={chip}>
        <FolderOpen className="size-4 text-muted-foreground" />
        <span className="font-medium">Fuentes</span>
      </Link>

      <ArrowRight className="size-4 shrink-0 text-muted-foreground/50" />

      {/* Proceso: el pipeline transforma */}
      <Link to={specPath(specId, `/etapa/${spec.current_stage}`)} className={chip}>
        <Workflow className="size-4 text-muted-foreground" />
        <span className="font-medium">{stageName}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {stageIdx + 1}/{STAGES.length}
        </span>
      </Link>

      <ArrowRight className="size-4 shrink-0 text-muted-foreground/50" />

      {/* Salida: lo que el sistema construye */}
      <Link
        to={specPath(specId)}
        className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-sm transition-colors hover:bg-primary/10"
      >
        <FileStack className="size-4 text-primary" />
        <span className="font-medium">Spec</span>
        <Badge variant="secondary" className="text-[10px]">
          v{spec.version}
        </Badge>
      </Link>
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        el sistema construye
      </span>
    </div>
  );
}
