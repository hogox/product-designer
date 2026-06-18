// Sidebar de navegación (D2 · W3): switcher de spec + meta + 7 etapas + trazabilidad.
// Migrado a Tailwind/shadcn (impulso visual): estados activos con bg-muted, chips real/mock
// como variantes de Badge, iconos de etapa lucide. Cero CSS legado.

import { Link, NavLink, useNavigate } from "react-router-dom";
import { ClipboardList, FileStack, FolderOpen, ScrollText, Workflow } from "lucide-react";
import type { Spec } from "@pda/spec";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STAGES } from "../stages";
import { specPath } from "../nav";
import { STAGE_ICON } from "./icons";
import { AccountMenu } from "./AccountMenu";
import type { StageState, SpecGroup } from "../api";

const navCls = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted",
    isActive && "bg-muted font-medium",
  );

export function StageSidebar({
  specId,
  groups,
  spec,
  state,
}: {
  specId: string | null;
  groups: SpecGroup[];
  spec: Spec | null;
  state: StageState | null;
}) {
  const navigate = useNavigate();

  // Switcher: specs activas del MISMO producto que la spec actual (D2 · W0.4).
  const product = spec?.product;
  const sameProduct =
    product != null
      ? (groups.find((g) => g.product === product)?.specs ?? []).filter(
          (s) => s.status === "activa",
        )
      : [];

  return (
    <aside className="sticky top-0 flex h-screen flex-col gap-3 overflow-y-auto border-r bg-card p-3">
      <AccountMenu />
      <Link to="/" className="px-2 text-sm font-bold text-foreground">
        Product Designer Agéntico
      </Link>

      <div className="flex flex-col gap-1.5 px-1">
        {sameProduct.length > 1 && (
          <select
            value={specId ?? ""}
            onChange={(e) => navigate(specPath(e.target.value))}
            aria-label={`Specs de ${product}`}
            className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
          >
            {sameProduct.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <Link
          to="/"
          className="text-xs text-primary underline-offset-4 hover:underline"
        >
          Ver todas las specs
        </Link>
      </div>

      {spec && (
        <div className="rounded-lg border bg-background p-2.5">
          <div className="mb-1.5 text-xs text-muted-foreground">
            {spec.product}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-mono">
              {spec.id}
            </Badge>
            <Badge variant="secondary">v{spec.version}</Badge>
            <Badge variant="secondary">{spec.status}</Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            etapa: {spec.current_stage}
            {state?.hasProposal ? " · propuesta pendiente" : ""}
          </div>
        </div>
      )}

      <nav className="flex flex-col gap-0.5">
        {/* ENTRADA: lo que el humano le da al sistema */}
        <div className="px-2.5 pt-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Entrada
        </div>
        <NavLink to={specPath(specId, "/intake")} className={navCls}>
          <ClipboardList className="size-4 text-muted-foreground" />
          Input
        </NavLink>
        <NavLink to={specPath(specId, "/fuentes")} className={navCls}>
          <FolderOpen className="size-4 text-muted-foreground" />
          Fuentes
        </NavLink>

        {/* SPEC: lo que el sistema construye */}
        <div className="px-2.5 pt-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Spec
        </div>
        <NavLink to={specPath(specId)} end className={navCls}>
          <FileStack className="size-4 text-muted-foreground" />
          Spec viva
        </NavLink>
        <div className="px-2.5 pt-2 pb-1 pl-4 text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
          Pipeline · 7 etapas
        </div>
        {STAGES.map((s) => {
          const Icon = STAGE_ICON[s.id] ?? Workflow;
          return (
            <NavLink
              key={s.id}
              to={specPath(specId, `/etapa/${s.id}`)}
              className={navCls}
            >
              <Icon className="size-4 text-muted-foreground" />
              <span className="flex-1">
                {s.n}. {s.name}
              </span>
              <Badge variant={s.real ? "real" : "mock"} className="text-[10px]">
                {s.real ? "real" : "mock"}
              </Badge>
            </NavLink>
          );
        })}

        <div className="px-2.5 pt-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Trazabilidad
        </div>
        <NavLink to={specPath(specId, "/auditoria")} className={navCls}>
          <ScrollText className="size-4 text-muted-foreground" />
          Auditoría
        </NavLink>
      </nav>

      <div className="mt-auto flex gap-3 px-2 pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" /> real
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-500" /> mockeado
        </span>
      </div>
    </aside>
  );
}
