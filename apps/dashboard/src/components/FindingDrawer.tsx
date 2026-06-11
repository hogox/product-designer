// Drawer de detalle de hallazgo (D2 · W4.1): Sheet stock (lado derecho). Saca el detalle
// profundo de la página principal — la tarjeta del triage queda compacta. Muestra la cadena
// completa evidencia → cálculo/cita → fuente con locator, el historial de revisión, y la
// trazabilidad inversa (qué JTBD lo citan). Sheet trae Esc + foco atrapado stock.

import { Anchor, History as HistoryIcon, Workflow } from "lucide-react";

import type { Finding, Job } from "@pda/spec";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  ConfidenceBadge,
  EvidenceKindBadge,
  FindingTypeBadge,
  ReviewStatusBadge,
  REVIEW_LABEL,
} from "./badges";

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Anchor;
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      <Icon className="size-3.5" />
      {children}
    </h3>
  );
}

export function FindingDrawer({
  finding,
  jtbd,
  open,
  onOpenChange,
}: {
  finding: Finding | null;
  jtbd: Job[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const f = finding;
  // Trazabilidad inversa real (invariante 5): los JTBD declaran qué hallazgos los
  // sustentan (supported_by). Las métricas del esquema v0 NO citan hallazgos directamente
  // — se derivan vía los JTBD —, así que no se inventan links que no existen.
  const citingJobs = f ? jtbd.filter((j) => j.supported_by.includes(f.id)) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {f && (
          <>
            <SheetHeader className="border-b">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="font-mono">
                  {f.id}
                </Badge>
                <ConfidenceBadge confidence={f.confidence} />
                <FindingTypeBadge type={f.type} />
                <ReviewStatusBadge status={f.review_status} />
              </div>
              <SheetTitle className="text-base leading-snug">
                {f.statement}
              </SheetTitle>
              <p className="text-xs text-muted-foreground">
                alimenta → {f.feeds}
              </p>
            </SheetHeader>

            <div className="space-y-6 p-4">
              {/* Cadena de evidencia anclada */}
              <section className="space-y-3">
                <SectionLabel icon={Anchor}>
                  Cadena de evidencia ({f.evidence.length})
                </SectionLabel>
                {f.evidence.map((e, i) => {
                  const kind = e.quote ? "cita" : "cálculo";
                  return (
                    <div key={i} className="space-y-1.5 border-l-2 pl-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <EvidenceKindBadge kind={kind} />
                        <span className="text-xs font-medium">{e.source}</span>
                        <Badge variant="outline" className="font-mono text-xs">
                          {e.locator}
                        </Badge>
                      </div>
                      <p className="text-sm">
                        {e.quote ? `"${e.quote}"` : e.computation}
                      </p>
                    </div>
                  );
                })}
              </section>

              {/* Historial de revisión */}
              <section className="space-y-2">
                <SectionLabel icon={HistoryIcon}>
                  Historial de revisión
                </SectionLabel>
                {f.reviewed_by ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ReviewStatusBadge status={f.review_status} />
                      <span className="text-muted-foreground">
                        por {f.reviewed_by}
                        {f.reviewed_at
                          ? ` · ${new Date(f.reviewed_at).toLocaleString()}`
                          : ""}
                      </span>
                    </div>
                    {f.review_note && (
                      <blockquote className="border-l-2 pl-3 text-muted-foreground italic">
                        “{f.review_note}”
                      </blockquote>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {REVIEW_LABEL[f.review_status]} — sin revisor todavía.
                  </p>
                )}
              </section>

              {/* Trazabilidad inversa */}
              <section className="space-y-2">
                <SectionLabel icon={Workflow}>
                  Trazabilidad inversa — JTBD que lo citan ({citingJobs.length})
                </SectionLabel>
                {citingJobs.length > 0 ? (
                  <ul className="space-y-2">
                    {citingJobs.map((j) => (
                      <li key={j.id} className="space-y-1 border-l-2 pl-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {j.id}
                        </Badge>
                        <p className="text-sm">{j.statement}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Ningún JTBD lo cita aún. (Las métricas se derivan vía los
                    JTBD; el esquema v0 no liga hallazgo→métrica directamente.)
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
