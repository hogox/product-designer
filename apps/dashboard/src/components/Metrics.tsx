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

export function Metrics({ shown }: { shown: Spec }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Gauge className="size-4 text-muted-foreground" />
          Métricas (HEART / GSM)
          <RealMockBadge real />
          <Badge variant="secondary">{shown.outcomes.length}</Badge>
        </CardTitle>
        <CardDescription>
          Baseline computado desde la evidencia; el target lo fija el humano en
          la compuerta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {shown.outcomes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Aún sin métricas.
          </p>
        ) : (
          <div className="divide-y">
            {shown.outcomes.map((o, i) => (
              <div className="space-y-1 py-3 first:pt-0 last:pb-0" key={i}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {o.heart && <HeartBadge category={o.heart} />}
                  <strong>{o.metric}</strong>
                </div>
                <p className="text-sm">
                  baseline: {o.baseline ?? "—"} → target: {o.target}{" "}
                  <span className="text-muted-foreground">({o.method})</span>
                </p>
                {o.signals && o.signals.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    señales: {o.signals.join("; ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
