// Vista holística de la spec viva (la fuente de verdad). Reusada en el overview.
// Rediseño: el contenido se agrupa POR ETAPA DE ORIGEN (Descubrimiento / Definición /
// Exploración / Transversal) con un header de etapa (icono + número + diamante), para que se
// vea de qué etapa nace cada cosa. Los contenidos repetitivos (outcomes/JTBD/conceptos) pasan
// de listas planas a sub-cards bordeadas. Sin tocar components/ui/.

import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  History,
  Sparkles,
  Target,
} from "lucide-react";

import type { Spec, Task } from "@pda/spec";

type TaskStatus = Task["status"];

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { specPath } from "../nav";
import { HeartBadge, RealMockBadge } from "./badges";
import { SectionIcon, STAGE_ICON, type IconTone } from "./icons";
import { ScopeViz } from "./viz/ScopeViz";
import { MetricBar } from "./viz/MetricBar";
import { CategoryBar } from "./viz/CategoryBar";

// --- task status helpers ---
const TASK_ICON: Record<TaskStatus, typeof Circle> = {
  todo: Circle,
  in_progress: Clock,
  done: CheckCircle2,
  blocked: AlertCircle,
};

const TASK_ICON_CLS: Record<TaskStatus, string> = {
  todo: "text-muted-foreground/40",
  in_progress: "text-amber-500",
  done: "text-emerald-500",
  blocked: "text-red-500",
};

const TASK_LABEL: Record<TaskStatus, string> = {
  todo: "pendiente",
  in_progress: "en curso",
  done: "listo",
  blocked: "bloqueada",
};

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

  // Spec "vacía" (recién creada, v0): nada acumulado por el pipeline todavía. Estado
  // explícito para no leerla como si fuera el input (invariante 1: la spec es el output).
  const isEmpty =
    !spec.problem_statement &&
    spec.findings.length === 0 &&
    spec.outcomes.length === 0 &&
    spec.jtbd.length === 0 &&
    spec.concepts.length === 0 &&
    spec.tasks.length === 0 &&
    spec.scope.in_scope.length === 0 &&
    spec.scope.non_goals.length === 0;

  // Map concept → JTBD for reverse lookup in the JTBD list
  const conceptsByJtbd = new Map<string, string[]>();
  for (const c of spec.concepts) {
    for (const jid of c.addresses_jtbd) {
      const existing = conceptsByJtbd.get(jid) ?? [];
      existing.push(c.id);
      conceptsByJtbd.set(jid, existing);
    }
  }

  const maxJtbdSupport =
    spec.jtbd.length > 0
      ? Math.max(...spec.jtbd.map((j) => j.supported_by.length))
      : 0;

  // Task status summary for Tareas SubCard
  const taskCounts: Record<TaskStatus, number> = {
    todo: 0,
    in_progress: 0,
    done: 0,
    blocked: 0,
  };
  for (const t of spec.tasks) taskCounts[t.status]++;

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
          <div className="flex flex-wrap gap-1.5 mt-1">
            <Badge variant="secondary">id: {spec.id}</Badge>
            <Badge variant="secondary">v{spec.version}</Badge>
            <Badge variant="secondary">{spec.status}</Badge>
            <Badge variant="secondary">etapa: {spec.current_stage}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold">{spec.title}</div>
        </CardContent>
      </Card>

      {/* Estado vacío: la spec todavía no fue poblada por ningún agente */}
      {isEmpty && (
        <Card className="border-dashed">
          <CardContent className="space-y-3 py-8 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
              <Sparkles className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Todavía no hay spec construida
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                La spec es lo que el sistema construye a partir de tu Input y
                tus Fuentes. Corré el Agente 1 (Descubrimiento) para empezar a
                poblarla con hallazgos anclados a evidencia.
              </p>
            </div>
            <Link to={specPath(spec.id, "/etapa/descubrimiento")}>
              <Button size="sm">Ir a Descubrimiento</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ① Descubrimiento */}
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
          {(spec.scope.in_scope.length > 0 || spec.scope.non_goals.length > 0) && (
            <SubCard title="Alcance">
              <ScopeViz
                in_scope={spec.scope.in_scope}
                non_goals={spec.scope.non_goals}
              />
            </SubCard>
          )}

          {spec.tasks.length > 0 && (
            <SubCard title="Tareas (hipótesis)" count={spec.tasks.length}>
              {/* Mini resumen de estados */}
              {spec.tasks.length > 1 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {(["done", "in_progress", "todo", "blocked"] as TaskStatus[])
                    .filter((s) => taskCounts[s] > 0)
                    .map((s) => {
                      const Icon = TASK_ICON[s];
                      return (
                        <span
                          key={s}
                          className="flex items-center gap-1 text-xs text-muted-foreground"
                        >
                          <Icon className={`size-3 ${TASK_ICON_CLS[s]}`} />
                          {taskCounts[s]} {TASK_LABEL[s]}
                        </span>
                      );
                    })}
                </div>
              )}

              <ul className="space-y-2 text-sm">
                {spec.tasks.map((t) => {
                  const Icon = TASK_ICON[t.status];
                  return (
                    <li key={t.id} className="flex items-start gap-2">
                      <Icon
                        className={`mt-0.5 size-3.5 shrink-0 ${TASK_ICON_CLS[t.status]}`}
                      />
                      <span>
                        {t.description}{" "}
                        <span className="text-muted-foreground">
                          ({t.owner})
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </SubCard>
          )}
        </StageGroup>
      )}

      {/* ② Definición */}
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
              <div className="space-y-3">
                {spec.jtbd.map((j) => {
                  const supportPct =
                    maxJtbdSupport > 0
                      ? (j.supported_by.length / maxJtbdSupport) * 100
                      : 0;
                  const concepts = conceptsByJtbd.get(j.id) ?? [];
                  return (
                    <div key={j.id} className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm">{j.statement}</p>

                      {/* Cobertura de evidencia */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground shrink-0">
                          Evidencia
                        </span>
                        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-sky-400"
                            style={{ width: `${supportPct}%` }}
                          />
                        </div>
                        <span className="w-4 shrink-0 text-right text-xs tabular-nums font-semibold text-sky-600">
                          {j.supported_by.length}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <IdChip>{j.id}</IdChip>
                        <span className="text-xs text-muted-foreground">←</span>
                        {j.supported_by.map((fid) => (
                          <IdChip key={fid}>{fid}</IdChip>
                        ))}
                        {concepts.length > 0 && (
                          <>
                            <span className="text-xs text-muted-foreground mx-0.5">·</span>
                            {concepts.map((cid) => (
                              <Badge
                                key={cid}
                                variant="outline"
                                className="font-mono text-[10px] border-amber-300 text-amber-700"
                              >
                                {cid}
                              </Badge>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SubCard>
          )}

          {spec.outcomes.length > 0 && (
            <SubCard title="Outcomes / métricas" count={spec.outcomes.length}>
              <div className="space-y-4">
                {/* Distribución HEART compacta */}
                <CategoryBar outcomes={spec.outcomes} />

                {spec.outcomes.some((o) => o.heart) && (
                  <div className="border-t" />
                )}

                {spec.outcomes.map((o, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {o.heart && <HeartBadge category={o.heart} />}
                      <span className="text-sm font-medium">{o.metric}</span>
                    </div>
                    <MetricBar baseline={o.baseline} target={o.target} />
                  </div>
                ))}
              </div>
            </SubCard>
          )}
        </StageGroup>
      )}

      {/* ③ Exploración */}
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

      {/* Transversal */}
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
