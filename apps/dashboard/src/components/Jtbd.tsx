import { Briefcase } from "lucide-react";

import type { Spec } from "@pda/spec";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RealMockBadge } from "./badges";
import { SectionIcon } from "./icons";

export function Jtbd({ shown }: { shown: Spec }) {
  const jtbd = shown.jtbd;
  const maxSupport = jtbd.length > 0
    ? Math.max(...jtbd.map((j) => j.supported_by.length))
    : 0;

  // Map concept → set of JTBD ids it addresses, for reverse lookup
  const conceptsByJtbd = new Map<string, string[]>();
  for (const c of shown.concepts) {
    for (const jid of c.addresses_jtbd) {
      const existing = conceptsByJtbd.get(jid) ?? [];
      existing.push(c.id);
      conceptsByJtbd.set(jid, existing);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <SectionIcon icon={Briefcase} tone="sky" />
          JTBD — Jobs To Be Done
          <RealMockBadge real />
          <Badge variant="secondary">{jtbd.length}</Badge>
        </CardTitle>
        <CardDescription>
          Cada job se ancla a los hallazgos que lo motivan (procedencia
          heredada).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {jtbd.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Aún sin JTBD (corré Definición).
          </p>
        ) : (
          <div className="divide-y">
            {jtbd.map((j) => {
              const supportPct =
                maxSupport > 0
                  ? (j.supported_by.length / maxSupport) * 100
                  : 0;
              const concepts = conceptsByJtbd.get(j.id) ?? [];

              return (
                <div
                  className="space-y-2 py-4 first:pt-0 last:pb-0"
                  key={j.id}
                >
                  <p className="text-sm leading-snug">{j.statement}</p>

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

                  {/* IDs de hallazgos + conceptos */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-mono text-xs">
                      {j.id}
                    </Badge>
                    <span>←</span>
                    {j.supported_by.map((fid) => (
                      <Badge
                        key={fid}
                        variant="outline"
                        className="font-mono text-xs"
                      >
                        {fid}
                      </Badge>
                    ))}
                    {concepts.length > 0 && (
                      <>
                        <span className="mx-0.5">·</span>
                        <span>abordado por</span>
                        {concepts.map((cid) => (
                          <Badge
                            key={cid}
                            variant="outline"
                            className="font-mono text-xs border-amber-300 text-amber-700"
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
        )}
      </CardContent>
    </Card>
  );
}
