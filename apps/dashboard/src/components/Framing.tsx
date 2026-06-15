import { Frame } from "lucide-react";
import type { ReactNode } from "react";

import type { Spec } from "@pda/spec";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionIcon } from "./icons";
import { ScopeViz } from "./viz/ScopeViz";
import { extractFirstNumber } from "./viz/parseMetric";

function NewBadge({
  isProposal,
  cond,
}: {
  isProposal: boolean;
  cond: boolean;
}): ReactNode {
  return isProposal && cond ? (
    <Badge variant="aprobado">nuevo</Badge>
  ) : null;
}

export function Framing({
  shown,
  current,
  isProposal,
}: {
  shown: Spec;
  current: Spec | null;
  isProposal: boolean;
}) {
  // Extrae el primer % del problem statement para el callout visual.
  // Solo se muestra si es un número porcentual — sin inventar contexto (invariante 5).
  const keyNum = shown.problem_statement
    ? extractFirstNumber(shown.problem_statement)
    : null;
  const showCallout = keyNum?.unit === "%";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <SectionIcon icon={Frame} tone="primary" />
          Enmarcado
          {isProposal && <Badge variant="aprobado">propuesta v+1</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 font-medium">
            Problem statement
            <NewBadge
              isProposal={isProposal}
              cond={!current?.problem_statement}
            />
          </h3>

          {shown.problem_statement ? (
            <>
              {/* Callout: primer % extraído del texto (literal de la spec) */}
              {showCallout && (
                <div className="inline-flex items-baseline gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5">
                  <span className="text-2xl font-bold tabular-nums text-primary">
                    {keyNum!.op ?? ""}
                    {keyNum!.value}%
                  </span>
                  <span className="text-xs text-primary/60">— cifra clave</span>
                </div>
              )}
              <p className="leading-relaxed">{shown.problem_statement}</p>
            </>
          ) : (
            <p className="text-muted-foreground italic">—</p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="flex items-center gap-2 font-medium">
            Alcance
            <NewBadge
              isProposal={isProposal}
              cond={
                (current?.scope.in_scope.length ?? 0) === 0 &&
                shown.scope.in_scope.length > 0
              }
            />
          </h3>
          {shown.scope.in_scope.length === 0 &&
          shown.scope.non_goals.length === 0 ? (
            <p className="text-muted-foreground italic">—</p>
          ) : (
            <ScopeViz
              in_scope={shown.scope.in_scope}
              non_goals={shown.scope.non_goals}
            />
          )}
        </section>
      </CardContent>
    </Card>
  );
}
