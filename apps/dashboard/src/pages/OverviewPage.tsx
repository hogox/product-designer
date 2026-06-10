// Overview "Spec viva" (W3.2): pila de Cards de la spec + Pipeline clickeable +
// auditoría reciente. Misma estructura de información que antes — solo cambia la piel.

import { Link } from "react-router-dom";
import { Workflow } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useShell } from "../App";
import { SpecOverview } from "../components/SpecOverview";
import { AuditPanel } from "../components/AuditPanel";
import { StatCards } from "../components/StatCards";
import { RealMockBadge } from "../components/badges";
import { SectionIcon, STAGE_ICON } from "../components/icons";
import { STAGES } from "../stages";
import { specPath } from "../nav";

export function OverviewPage() {
  const { specId, spec, findings, audit, state } = useShell();

  if (!spec) {
    return (
      <p className="text-sm text-muted-foreground italic">Cargando spec…</p>
    );
  }

  return (
    <div className="space-y-4">
      <StatCards spec={spec} findings={findings} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <SpecOverview spec={spec} />
        <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionIcon icon={Workflow} tone="primary" />
              Pipeline
              <Badge variant="secondary">7 etapas</Badge>
            </CardTitle>
            {state?.hasProposal && (
              <CardDescription>
                Hay una <strong>propuesta pendiente</strong> de compuerta —{" "}
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  to={specPath(specId, "/etapa/definicion/compuerta")}
                >
                  entrá a la etapa de Definición
                </Link>
                .
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {STAGES.map((s) => (
              <Link
                key={s.id}
                to={specPath(specId, `/etapa/${s.id}`)}
                className="flex items-center gap-3 rounded-lg border p-3 text-foreground transition-colors hover:border-primary/30 hover:bg-muted/50"
              >
                <SectionIcon
                  icon={STAGE_ICON[s.id] ?? Workflow}
                  tone={s.real ? "primary" : "slate"}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {s.n}. {s.name} <RealMockBadge real={s.real} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.diamante} · {s.modo}
                  </div>
                </div>
                {s.gate && (
                  <Badge
                    variant="outline"
                    className="ml-auto shrink-0 border-primary/40 text-primary"
                  >
                    gate: {s.gate}
                  </Badge>
                )}
              </Link>
            ))}
          </CardContent>
        </Card>
          <AuditPanel entries={audit} limit={6} title="Auditoría reciente" />
        </div>
      </div>
    </div>
  );
}
