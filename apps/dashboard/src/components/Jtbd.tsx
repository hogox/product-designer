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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <SectionIcon icon={Briefcase} tone="sky" />
          JTBD — Jobs To Be Done
          <RealMockBadge real />
          <Badge variant="secondary">{shown.jtbd.length}</Badge>
        </CardTitle>
        <CardDescription>
          Cada job se ancla a los hallazgos que lo motivan (procedencia
          heredada).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {shown.jtbd.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Aún sin JTBD (corré Definición).
          </p>
        ) : (
          <div className="divide-y">
            {shown.jtbd.map((j) => (
              <div className="space-y-1 py-3 first:pt-0 last:pb-0" key={j.id}>
                <p className="text-sm">{j.statement}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="font-mono text-xs">
                    {j.id}
                  </Badge>
                  ← sustentado por: {j.supported_by.join(", ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
