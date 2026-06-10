import { Frame } from "lucide-react";
import type { ReactNode } from "react";

import type { Spec } from "@pda/spec";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function NewBadge({
  isProposal,
  cond,
}: {
  isProposal: boolean;
  cond: boolean;
}): ReactNode {
  return isProposal && cond ? (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-emerald-700"
    >
      nuevo
    </Badge>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Frame className="size-4 text-muted-foreground" />
          Enmarcado
          {isProposal && (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700"
            >
              propuesta v+1
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <section className="space-y-1.5">
          <h3 className="flex items-center gap-2 font-medium">
            Problem statement
            <NewBadge
              isProposal={isProposal}
              cond={!current?.problem_statement}
            />
          </h3>
          <p className="leading-relaxed">{shown.problem_statement ?? "—"}</p>
        </section>

        <section className="space-y-1.5">
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
          <div>
            <em>In-scope:</em>{" "}
            {shown.scope.in_scope.length ? (
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {shown.scope.in_scope.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              "—"
            )}
          </div>
          <div>
            <em>Non-goals:</em>{" "}
            {shown.scope.non_goals.length ? (
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {shown.scope.non_goals.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              "—"
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
