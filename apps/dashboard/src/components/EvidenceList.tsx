// Evidencia anclada, agrupada por fuente. Toda evidencia ancla a archivo + locator + cita
// (texto) o cálculo (tabular) — la base anti-alucinación (invariante 5).
// W3.2 (§2 del anexo): la cita/cálculo sube de jerarquía (text-sm foreground, ya no es
// el texto más chico de la pantalla); el locator es un chip outline mono.

import { Anchor } from "lucide-react";

import type { Finding } from "@pda/spec";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EvidenceKindBadge, RealMockBadge } from "./badges";

interface AnchorItem {
  finding: string;
  locator: string;
  text: string;
  kind: "cita" | "cálculo";
}

export function EvidenceList({ findings }: { findings: Finding[] }) {
  const bySource = new Map<string, AnchorItem[]>();
  for (const f of findings) {
    for (const e of f.evidence) {
      const arr = bySource.get(e.source) ?? [];
      arr.push({
        finding: f.id,
        locator: e.locator,
        text: e.quote ?? e.computation ?? "",
        kind: e.quote ? "cita" : "cálculo",
      });
      bySource.set(e.source, arr);
    }
  }

  if (bySource.size === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            Sin evidencia (no hay hallazgos todavía).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Anchor className="size-4 text-muted-foreground" />
          Evidencia anclada
          <RealMockBadge real />
          <Badge variant="secondary">{bySource.size} fuentes</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {[...bySource.entries()].map(([source, anchors]) => (
          <div className="space-y-3" key={source}>
            <h3 className="text-sm font-medium">{source}</h3>
            {anchors.map((a, i) => (
              <div key={i} className="space-y-1 border-l-2 pl-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <EvidenceKindBadge kind={a.kind} />
                  <Badge variant="outline" className="font-mono text-xs">
                    {a.locator}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {a.finding}
                  </span>
                </div>
                <p className="text-sm">
                  {a.kind === "cita" ? `"${a.text}"` : a.text}
                </p>
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
