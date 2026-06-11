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

export function StatCards({
  spec,
  findings,
  concepts = [],
}: {
  spec: Spec;
  findings: Finding[];
  concepts?: Concept[];
}) {
  // El working set (findings) trae el estado de revisión vivo; si está vacío (spec ya
  // aprobada sin propuesta), cae a los hallazgos consolidados en la spec.
  const fs = findings.length > 0 ? findings : spec.findings;
  const by = (s: ReviewStatus) =>
    fs.filter((f) => f.review_status === s).length;

  // Conceptos en triage (concepts.yaml) o ya promovidos a la spec (post-cierre).
  const cs = concepts.length > 0 ? concepts : spec.concepts;
  const selected = cs.filter((c) => c.review_status === "seleccionado").length;
  const showConcepts = cs.length > 0;

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
          fs.length > 0
            ? `${by("aprobado")} aprob · ${by("pendiente")} pend · ${by("en_pausa")} pausa`
            : "sin hallazgos"
        }
      />
      <Stat
        icon={Briefcase}
        tone="sky"
        value={spec.jtbd.length}
        label="JTBD"
      />
      <Stat
        icon={Gauge}
        tone="violet"
        value={spec.outcomes.length}
        label="Métricas"
      />
      {showConcepts && (
        <Stat
          icon={Lightbulb}
          tone="amber"
          value={cs.length}
          label="Conceptos"
          hint={`${selected} seleccionado${selected === 1 ? "" : "s"}`}
        />
      )}
    </div>
  );
}
