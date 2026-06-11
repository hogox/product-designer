// Vista holística de la spec viva (la fuente de verdad). Reusada en el overview.
// W3.2: pila de Cards modulares con header propio (icono + título + badge + contador),
// misma información y mismos nombres de sección que antes (cambio de piel, no de IA).

import {
  Briefcase,
  FileText,
  Gauge,
  History,
  Lightbulb,
  ListChecks,
  ListTodo,
  Target,
} from "lucide-react";

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
import { SectionIcon } from "./icons";

function EmptyNote() {
  return <p className="text-sm text-muted-foreground italic">Vacío.</p>;
}

export function SpecOverview({ spec }: { spec: Spec }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <SectionIcon icon={FileText} tone="primary" />
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

      {spec.problem_statement && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionIcon icon={Target} tone="primary" />
              Problem statement (Definición)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed">
            {spec.problem_statement}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SectionIcon icon={Gauge} tone="violet" />
            Outcomes / métricas
            <Badge variant="secondary">{spec.outcomes.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {spec.outcomes.length === 0 ? (
            <EmptyNote />
          ) : (
            <ul className="space-y-3 text-sm">
              {spec.outcomes.map((o, i) => (
                <li key={i}>
                  <div className="flex flex-wrap items-center gap-2">
                    {o.heart && <HeartBadge category={o.heart} />}
                    <strong>{o.metric}</strong>
                  </div>
                  <div>
                    {o.baseline ?? "—"} → {o.target}{" "}
                    <span className="text-muted-foreground">({o.method})</span>
                  </div>
                  {o.signals && o.signals.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      señales: {o.signals.join("; ")}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {spec.jtbd.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionIcon icon={Briefcase} tone="sky" />
              JTBD — Jobs To Be Done
              <Badge variant="secondary">{spec.jtbd.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {spec.jtbd.map((j) => (
                <li key={j.id}>
                  {j.statement}{" "}
                  <span className="text-muted-foreground">
                    ({j.id} ← {j.supported_by.join(", ")})
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {spec.concepts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionIcon icon={Lightbulb} tone="amber" />
              Conceptos de solución
              <Badge variant="secondary">{spec.concepts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {spec.concepts.map((c) => (
                <li key={c.id}>
                  <span className="font-medium">{c.title}</span>{" "}
                  <span className="text-muted-foreground">
                    ({c.id} → {c.addresses_jtbd.join(", ")})
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SectionIcon icon={ListChecks} tone="slate" />
            Alcance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>
            <em>In-scope:</em>{" "}
            {spec.scope.in_scope.length ? spec.scope.in_scope.join("; ") : "—"}
          </div>
          <div>
            <em>Non-goals:</em>{" "}
            {spec.scope.non_goals.length
              ? spec.scope.non_goals.join("; ")
              : "—"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SectionIcon icon={ListTodo} tone="slate" />
            Tareas (hipótesis)
            <Badge variant="secondary">{spec.tasks.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {spec.tasks.length === 0 ? (
            <EmptyNote />
          ) : (
            <ul className="space-y-2 text-sm">
              {spec.tasks.map((t) => (
                <li key={t.id}>
                  [{t.status}] {t.description}{" "}
                  <span className="text-muted-foreground">({t.owner})</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SectionIcon icon={History} tone="slate" />
            Historial (procedencia)
            <Badge variant="secondary">{spec.history.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {spec.history.length === 0 ? (
            <EmptyNote />
          ) : (
            <ul className="space-y-2 text-sm">
              {spec.history.map((h, i) => (
                <li key={i}>
                  v{h.version} — {h.change_summary}{" "}
                  <span className="text-muted-foreground">
                    (propuso {h.proposed_by}, aprobó {h.approved_by ?? "—"})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
