import { CircleCheck, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

export function ScopeViz({
  in_scope,
  non_goals,
}: {
  in_scope: string[];
  non_goals: string[];
}) {
  const total = in_scope.length + non_goals.length;
  if (total === 0) return null;

  const inPct = (in_scope.length / total) * 100;

  return (
    <div className="space-y-3">
      {/* Balance bar: in-scope vs non-goals */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-emerald-400" />
            In-scope ({in_scope.length})
          </span>
          <span className="flex items-center gap-1.5">
            Non-goals ({non_goals.length})
            <span className="inline-block size-2 rounded-full bg-muted-foreground/30" />
          </span>
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-emerald-400"
            style={{ width: `${inPct}%` }}
          />
        </div>
      </div>

      {/* In-scope items */}
      {in_scope.length > 0 && (
        <div className="space-y-1.5">
          {in_scope.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Non-goals items */}
      {non_goals.length > 0 && (
        <div className={cn("space-y-1.5", in_scope.length > 0 && "border-t pt-3")}>
          {non_goals.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Minus className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
