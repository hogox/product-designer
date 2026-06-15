// Overview "Spec viva" (W3.2): pila de Cards de la spec + Pipeline clickeable +
// auditoría reciente. Misma estructura de información que antes — solo cambia la piel.

import { Link } from "react-router-dom";
import { HelpCircle, Workflow } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const { specId, spec, findings, concepts, audit, state } = useShell();

  if (!spec) {
    return (
      <p className="text-sm text-muted-foreground italic">Cargando spec…</p>
    );
  }

  // W3.4(a): el resumen del overview muestra SOLO la actividad de la última propuesta
  // (desde la última entrada `agent.proposed`), no iteraciones viejas que confunden los
  // conteos. El log completo vive en /auditoria ("ver todo").
  const lastProposalIdx = audit.map((e) => e.action).lastIndexOf("agent.proposed");
  const proposalAudit =
    lastProposalIdx >= 0 ? audit.slice(lastProposalIdx) : audit.slice(-6);

  return (
    <div className="space-y-4">
      <StatCards spec={spec} findings={findings} concepts={concepts} />

      {/* W6.3: encabezado de contexto — pregunta de investigación o CTA para definirla */}
      {spec.intake?.researchQuestion ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium tracking-wide text-primary uppercase">
                  Pregunta de investigación
                </div>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {spec.intake.researchQuestion}
                </p>
                {spec.intake.hypotheses.filter((h) => h).length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {spec.intake.hypotheses
                      .filter((h) => h)
                      .map((h, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 rounded-md bg-primary/5 px-2.5 py-2"
                        >
                          <span className="mt-0.5 shrink-0 rounded bg-primary/20 px-1 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
                            H{i + 1}
                          </span>
                          <p className="text-xs leading-relaxed text-foreground">
                            {h}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <Link to={specPath(specId, "/intake")}>
                <Button variant="outline" size="sm">
                  Editar enmarcado
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <HelpCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Sin enmarcado definido</p>
                  <p className="text-xs text-muted-foreground">
                    La pregunta de investigación ayuda al Agente 1 a priorizar
                    hallazgos.
                  </p>
                </div>
              </div>
              <Link to={specPath(specId, "/intake")}>
                <Button size="sm">Definir enmarcado</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

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
          <AuditPanel
            entries={proposalAudit}
            title={
              lastProposalIdx >= 0
                ? "Auditoría de la propuesta"
                : "Auditoría reciente"
            }
            viewAllHref={specPath(specId, "/auditoria")}
            viewAllCount={audit.length}
          />
        </div>
      </div>
    </div>
  );
}
