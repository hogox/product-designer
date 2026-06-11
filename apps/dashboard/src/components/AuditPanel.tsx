// Log de auditoría (invariante 7): quién/qué/cuándo. Card modular (W3.2) con avatar de
// actor (impulso visual, paso 2d): humano con iniciales, agente con icono Bot.

import { Link } from "react-router-dom";
import { ScrollText } from "lucide-react";

import type { AuditEntry } from "@pda/spec";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RealMockBadge } from "./badges";
import { ActorAvatar } from "./ActorAvatar";
import { SectionIcon } from "./icons";

export function AuditPanel({
  entries,
  limit,
  title = "Log de auditoría",
  viewAllHref,
  viewAllCount,
}: {
  entries: AuditEntry[];
  limit?: number;
  title?: string;
  viewAllHref?: string; // si está, muestra footer "Ver todo (N) →"
  viewAllCount?: number; // total real del log (para el contador del footer)
}) {
  const recent = [...entries].reverse().slice(0, limit ?? entries.length);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <SectionIcon icon={ScrollText} tone="slate" />
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
              <div className="flex gap-3 py-3 first:pt-0 last:pb-0" key={i}>
                <ActorAvatar actor={e.actor} />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-sm font-medium">{e.actor}</span>
                    <Badge variant="outline" className="font-mono">
                      {e.action}
                    </Badge>
                  </div>
                  {(e.target || e.reason) && (
                    <div className="mt-0.5 text-muted-foreground">
                      {e.target}
                      {e.reason ? ` — ${e.reason}` : ""}
                    </div>
                  )}
                  <div className="mt-0.5 text-muted-foreground">
                    {e.timestamp}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {viewAllHref && (
          <Link
            to={viewAllHref}
            className="mt-3 inline-block text-xs text-primary underline-offset-4 hover:underline"
          >
            Ver todo el log{viewAllCount != null ? ` (${viewAllCount})` : ""} →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
