import { Gauge } from "lucide-react";

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
import { MetricBar } from "./viz/MetricBar";
import { CategoryBar } from "./viz/CategoryBar";

export function Metrics({ shown }: { shown: Spec }) {
  const outcomes = shown.outcomes;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <SectionIcon icon={Gauge} tone="violet" />
          Métricas (HEART / GSM)
          <RealMockBadge real />
          <Badge variant="secondary">{outcomes.length}</Badge>
        </CardTitle>
        <CardDescription>
          Baseline computado desde la evidencia; el target lo fija el humano en
          la compuerta.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {outcomes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Aún sin métricas.
          </p>
        ) : (
          <>
            {/* Distribución por dimensión HEART */}
            <CategoryBar outcomes={outcomes} />

            {outcomes.some((o) => o.heart) && (
              <div className="border-t" />
            )}

            {/* Métricas individuales */}
            <div className="divide-y">
              {outcomes.map((o, i) => (
                <div
                  key={i}
                  className="space-y-2 py-4 first:pt-0 last:pb-0"
                >
                  {/* Nombre + categoría HEART */}
                  <div className="flex flex-wrap items-center gap-2">
                    {o.heart && <HeartBadge category={o.heart} />}
                    <span className="text-sm font-medium">{o.metric}</span>
                  </div>

                  {/* Barra baseline → target (o fallback a texto) */}
                  <MetricBar baseline={o.baseline} target={o.target} />

                  {/* Método de medición */}
                  <p className="text-xs text-muted-foreground">{o.method}</p>

                  {/* Señales como chips */}
                  {o.signals && o.signals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
