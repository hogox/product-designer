// Log de auditoría (invariante 7): quién/qué/cuándo. Card modular (W3.2).

import { ScrollText } from "lucide-react";

import type { AuditEntry } from "@pda/spec";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RealMockBadge } from "./badges";

export function AuditPanel({
  entries,
  limit,
  title = "Log de auditoría",
}: {
  entries: AuditEntry[];
  limit?: number;
  title?: string;
}) {
  const recent = [...entries].reverse().slice(0, limit ?? entries.length);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <ScrollText className="size-4 text-muted-foreground" />
          {title}
          <RealMockBadge real />
          <Badge variant="secondary">{entries.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Sin entradas todavía.
          </p>
        ) : (
          <div className="divide-y">
            {recent.map((e, i) => (
              <div className="py-2 text-xs first:pt-0 last:pb-0" key={i}>
                <span className="font-semibold">{e.actor}</span>{" "}
                <span className="text-primary">{e.action}</span>
                {e.target ? ` · ${e.target}` : ""}
                {e.reason ? ` — ${e.reason}` : ""}
                <div className="text-muted-foreground">{e.timestamp}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
