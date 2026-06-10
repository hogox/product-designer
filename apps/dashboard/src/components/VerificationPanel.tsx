// Panel de verificación: lista criterios con su estado pass/fail. Sirve tanto para los
// criterios de Descubrimiento (cliente) como para los de la propuesta (VerificationCriterion).

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionIcon } from "./icons";

export interface Criterion {
  criterion: string;
  status: string; // "pass" | "fail" | "pending"
  evidence: string | null;
  blocking?: boolean; // si es false, un fail es advertencia (no bloquea la compuerta)
}

function StatusIcon({ c }: { c: Criterion }) {
  // fail no bloqueante = advertencia (ámbar), no un ✗ rojo de bloqueo
  if (c.status === "pass")
    return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />;
  if (c.status === "fail")
    return c.blocking === false ? (
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
    ) : (
      <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
    );
  return (
    <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
  );
}

export function VerificationPanel({
  criteria,
  title = "Verificación automatizada",
}: {
  criteria: Criterion[];
  title?: string;
}) {
  if (criteria.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            Sin criterios de verificación todavía.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <SectionIcon icon={ShieldCheck} tone="emerald" />
          {title}
          <Badge variant="secondary">{criteria.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {criteria.map((c, i) => {
          const warning = c.status === "fail" && c.blocking === false;
          return (
            <div key={i} className="flex items-start gap-2 text-sm">
              <StatusIcon c={c} />
              <span>
                {c.criterion}
                {warning ? " (advertencia)" : ""}
                {c.evidence ? (
                  <span className="text-muted-foreground"> — {c.evidence}</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
