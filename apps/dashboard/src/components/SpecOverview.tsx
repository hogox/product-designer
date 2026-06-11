// Vista holística de la spec viva (la fuente de verdad). Reusada en el overview.
// Rediseño: el contenido se agrupa POR ETAPA DE ORIGEN (Descubrimiento / Definición /
// Exploración / Transversal) con un header de etapa (icono + número + diamante), para que se
// vea de qué etapa nace cada cosa. Los contenidos repetitivos (outcomes/JTBD/conceptos) pasan
// de listas planas a sub-cards bordeadas. Sin tocar components/ui/.

import { History, Target } from "lucide-react";

import type { Spec } from "@pda/spec";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeartBadge, RealMockBadge } from "./badges";
import { SectionIcon, STAGE_ICON, type IconTone } from "./icons";

function EmptyNote() {
  return <p className="text-sm text-muted-foreground italic">Vacío.</p>;
}

/** Chip mono compacto para ids (J-001, F-003, C-002). */
function IdChip({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="outline" className="font-mono text-[10px]">
      {children}
    </Badge>
  );
}

/** Grupo de contenido de una etapa: header (icono + número + diamante) + cards debajo. */
function StageGroup({
  n,
  name,
  stageId,
  tone,
  diamante,
  children,
}: {
  n: number;
  name: string;
  stageId: string;
  tone: IconTone;
  diamante: string;
  children: React.ReactNode;
}) {
  const Icon = STAGE_ICON[stageId] ?? Target;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <SectionIcon icon={Icon} tone={tone} />
        <span className="text-sm font-semibold">
          {n} · {name}
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {diamante}
        </Badge>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Sub-card de contenido (caja bordeada ligera dentro de una Card de sección). */
function SubCard({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {title}
          {count != null && (
            <Badge variant="secondary" className="text-[10px]">
              {count}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function SpecOverview({ spec }: { spec: Spec }) {
  const conceptDecisions = spec.decisions;

  return (
    <div className="space-y-6">
      {/* Identidad de la spec (header, no es una etapa) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <SectionIcon icon={STAGE_ICON.descubrimiento ?? Target} tone="primary" />
            Spec viva
            <RealMockBadge real />
          </CardTitle>
          <CardDescription className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">id: {spec.id}</Badge>
            <Badge variant="secondary">v{spec.version}</Badge>
            <Badge variant="secondary">{spec.status}</Badge>
            <Badge variant="secondary">etapa: {spec.current_stage}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold">{spec.title}</div>
        </CardContent>
      </Card>

      {/* ① Descubrimiento — nace con la spec */}
      {(spec.scope.in_scope.length > 0 ||
        spec.scope.non_goals.length > 0 ||
        spec.tasks.length > 0) && (
        <StageGroup
          n={1}
          name="Descubrimiento"
          stageId="descubrimiento"
          tone="emerald"
          diamante="Problema"
        >
          <SubCard title="Alcance">
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">In-scope: </span>
                {spec.scope.in_scope.length
                  ? spec.scope.in_scope.join("; ")
                  : "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Non-goals: </span>
                {spec.scope.non_goals.length
                  ? spec.scope.non_goals.join("; ")
                  : "—"}
              </div>
            </div>
          </SubCard>

          {spec.tasks.length > 0 && (
            <SubCard title="Tareas (hipótesis)" count={spec.tasks.length}>
              <ul className="space-y-2 text-sm">
                {spec.tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {t.status}
                    </Badge>
                    <span>
                      {t.description}{" "}
                      <span className="text-muted-foreground">({t.owner})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </SubCard>
          )}
        </StageGroup>
      )}

      {/* ② Definición — diamante Problema */}
      {(spec.problem_statement ||
        spec.outcomes.length > 0 ||
        spec.jtbd.length > 0) && (
        <StageGroup
          n={2}
          name="Definición"
          stageId="definicion"
          tone="primary"
          diamante="Problema"
        >
          {spec.problem_statement && (
            <SubCard title="Problem statement">
              <p className="text-sm leading-relaxed">{spec.problem_statement}</p>
            </SubCard>
          )}

          {spec.jtbd.length > 0 && (
            <SubCard title="JTBD — Jobs To Be Done" count={spec.jtbd.length}>
              <div className="space-y-2">
                {spec.jtbd.map((j) => (
                  <div key={j.id} className="rounded-lg border p-3">
                    <p className="text-sm">{j.statement}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <IdChip>{j.id}</IdChip>
                      <span className="text-xs text-muted-foreground">←</span>
                      {j.supported_by.map((fid) => (
                        <IdChip key={fid}>{fid}</IdChip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SubCard>
          )}

          {spec.outcomes.length > 0 && (
            <SubCard title="Outcomes / métricas" count={spec.outcomes.length}>
              <div className="space-y-2">
                {spec.outcomes.map((o, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {o.heart && <HeartBadge category={o.heart} />}
                      <strong className="text-sm">{o.metric}</strong>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5 text-sm">
                      <span className="text-muted-foreground tabular-nums">
                        {o.baseline ?? "—"}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium tabular-nums">{o.target}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {o.method}
                    </div>
                    {o.signals && o.signals.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {o.signals.map((s, k) => (
                          <span
                            key={k}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SubCard>
          )}
        </StageGroup>
      )}

      {/* ③ Exploración — diamante Solución */}
      {(spec.concepts.length > 0 || conceptDecisions.length > 0) && (
        <StageGroup
          n={3}
          name="Exploración"
          stageId="exploracion"
          tone="amber"
          diamante="Solución"
        >
          {spec.concepts.length > 0 && (
            <SubCard title="Conceptos de solución" count={spec.concepts.length}>
              <div className="space-y-2">
                {spec.concepts.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{c.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <IdChip>{c.id}</IdChip>
                      <span className="text-xs text-muted-foreground">→</span>
                      {c.addresses_jtbd.map((jid) => (
                        <IdChip key={jid}>{jid}</IdChip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SubCard>
          )}

          {conceptDecisions.length > 0 && (
            <SubCard title="Decisiones" count={conceptDecisions.length}>
              <div className="space-y-2">
                {conceptDecisions.map((d) => (
                  <div key={d.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <IdChip>{d.id}</IdChip>
                      <span className="text-sm font-medium">{d.decision}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {d.rationale}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {d.date} · {d.author}
                    </p>
                  </div>
                ))}
              </div>
            </SubCard>
          )}
        </StageGroup>
      )}

      {/* Transversal — procedencia (fuera del riel de etapas) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5">
          <SectionIcon icon={History} tone="slate" />
          <span className="text-sm font-semibold">Transversal</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <SubCard title="Historial (procedencia)" count={spec.history.length}>
          {spec.history.length === 0 ? (
            <EmptyNote />
          ) : (
            <ul className="space-y-2 text-sm">
              {spec.history.map((h, i) => (
                <li key={i}>
                  <span className="font-medium tabular-nums">v{h.version}</span>{" "}
                  — {h.change_summary}{" "}
                  <span className="text-muted-foreground">
                    (propuso {h.proposed_by}, aprobó {h.approved_by ?? "—"})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SubCard>
      </section>
    </div>
  );
}
