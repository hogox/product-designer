// Fila de stat-cards del overview "Spec viva" (impulso visual, paso 2b): número grande +
// etiqueta muted, patrón de tarjetas-métrica de Stratify. Lee de la spec viva + el working
// set de hallazgos (para el desglose por estado de revisión).

import { Briefcase, GitBranch, Gauge, Lightbulb, ListChecks } from "lucide-react";
import type { Spec, Finding, Concept, ReviewStatus } from "@pda/spec";

import { Card } from "@/components/ui/card";
import { SectionIcon, type IconTone } from "./icons";

function Stat({
  icon,
  tone,
  value,
  label,
  hint,
}: {
  icon: typeof GitBranch;
  tone: IconTone;
  value: React.ReactNode;
  label: string;
  hint?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <SectionIcon icon={icon} tone={tone} />
        <div className="min-w-0">
          <div className="text-2xl leading-none font-semibold">{value}</div>
          <div className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">
            {label}
          </div>
        </div>
      </div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

/** Barra apilada proporcional (segmentos con flex: count). */
function StackedBar({
  segments,
}: {
  segments: Array<{ count: number; cls: string }>;
}) {
  const total = segments.reduce((s, seg) => s + seg.count, 0);
  if (total === 0) return null;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full">
      {segments
        .filter((s) => s.count > 0)
        .map((s, i) => (
          <div key={i} className={s.cls} style={{ flex: s.count }} />
        ))}
    </div>
  );
}

/** Barra simple con un solo valor sobre un total. */
function CoverageBar({
  covered,
  total,
  cls,
}: {
  covered: number;
  total: number;
  cls: string;
}) {
  const pct = total > 0 ? (covered / total) * 100 : 0;
  return (
    <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={`absolute inset-y-0 left-0 ${cls}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function StatCards({
  spec,
  findings,
  concepts = [],
}: {
  spec: Spec;
  findings: Finding[];
  concepts?: Concept[];
}) {
  const fs = findings.length > 0 ? findings : spec.findings;
  const by = (s: ReviewStatus) =>
    fs.filter((f) => f.review_status === s).length;

  const cs = concepts.length > 0 ? concepts : spec.concepts;
  const selected = cs.filter((c) => c.review_status === "seleccionado").length;
  const proposed = cs.filter((c) => c.review_status === "propuesto").length;
  const discarded = cs.filter((c) => c.review_status === "descartado").length;
  const showConcepts = cs.length > 0;

  // JTBD con al menos un hallazgo aprobado
  const coveredJtbd = spec.jtbd.filter((j) =>
    j.supported_by.some(
      (fid) => fs.find((f) => f.id === fid)?.review_status === "aprobado",
    ),
  ).length;

  // Dimensiones HEART representadas
  const heartDims = new Set(
    spec.outcomes.map((o) => o.heart).filter(Boolean),
  ).size;

  return (
    <div
      className={`grid grid-cols-2 gap-3 ${showConcepts ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
    >
      <Stat
        icon={GitBranch}
        tone="primary"
        value={`v${spec.version}`}
        label="Versión"
        hint={spec.status}
      />

      <Stat
        icon={ListChecks}
        tone="emerald"
        value={fs.length}
        label="Hallazgos"
        hint={
          fs.length > 0 ? (
            <div className="space-y-1">
              <StackedBar
                segments={[
                  { count: by("aprobado"), cls: "bg-emerald-400" },
                  { count: by("pendiente"), cls: "bg-muted-foreground/20" },
                  { count: by("en_pausa"), cls: "bg-amber-400" },
                  { count: by("rechazado"), cls: "bg-red-400" },
                ]}
              />
              <span>
                {by("aprobado")} aprob · {by("pendiente")} pend
                {by("en_pausa") > 0 && ` · ${by("en_pausa")} pausa`}
              </span>
            </div>
          ) : (
            "sin hallazgos"
          )
        }
      />

      <Stat
        icon={Briefcase}
        tone="sky"
        value={spec.jtbd.length}
        label="JTBD"
        hint={
          spec.jtbd.length > 0 ? (
            <div className="space-y-1">
              <CoverageBar
                covered={coveredJtbd}
                total={spec.jtbd.length}
                cls="bg-sky-400"
              />
              <span>
                {coveredJtbd}/{spec.jtbd.length} con evidencia
              </span>
            </div>
          ) : undefined
        }
      />

      <Stat
        icon={Gauge}
        tone="violet"
        value={spec.outcomes.length}
        label="Métricas"
        hint={
          spec.outcomes.length > 0
            ? `${heartDims}/5 dimensiones HEART`
            : undefined
        }
      />

      {showConcepts && (
        <Stat
          icon={Lightbulb}
          tone="amber"
          value={cs.length}
          label="Conceptos"
          hint={
            <div className="space-y-1">
              <StackedBar
                segments={[
                  { count: selected, cls: "bg-emerald-400" },
                  { count: proposed, cls: "bg-muted-foreground/20" },
                  { count: discarded, cls: "bg-red-400/50" },
                ]}
              />
              <span>
                {selected} seleccionado{selected !== 1 ? "s" : ""}
              </span>
            </div>
          }
        />
      )}
    </div>
  );
}
