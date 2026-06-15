import type { Outcome } from "@pda/spec";

import { cn } from "@/lib/utils";
import { HEART_ICON, type IconTone } from "@/components/icons";
import { HEART_BAR_FILL, HEART_ICON_TEXT } from "./colors";

type HeartCat =
  | "happiness"
  | "engagement"
  | "adoption"
  | "retention"
  | "task_success";

const HEART_CATS: HeartCat[] = [
  "task_success",
  "engagement",
  "adoption",
  "retention",
  "happiness",
];

const HEART_LABEL: Record<HeartCat, string> = {
  happiness: "Happiness",
  engagement: "Engagement",
  adoption: "Adoption",
  retention: "Retention",
  task_success: "Task success",
};

// Distribution of outcomes by HEART category as compact mini-bars.
// Returns null when no outcomes carry a heart category (avoids empty UI).
export function CategoryBar({ outcomes }: { outcomes: Outcome[] }) {
  const counts: Record<HeartCat, number> = {
    happiness: 0,
    engagement: 0,
    adoption: 0,
    retention: 0,
    task_success: 0,
  };

  for (const o of outcomes) {
    if (o.heart) counts[o.heart as HeartCat]++;
  }

  const max = Math.max(...Object.values(counts));
  if (max === 0) return null;

  const covered = HEART_CATS.filter((c) => counts[c] > 0).length;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Dimensiones HEART cubiertas:{" "}
        <span className="font-medium text-foreground">{covered}/5</span>
      </p>
      <div className="space-y-1.5">
        {HEART_CATS.map((cat) => {
          const n = counts[cat];
          const pct = (n / max) * 100;
          const Icon = HEART_ICON[cat];
          return (
            <div key={cat} className="flex items-center gap-2">
              <Icon
                className={cn(
                  "size-3.5 shrink-0",
                  n > 0 ? HEART_ICON_TEXT[cat] : "text-muted-foreground/30",
                )}
              />
              <span
                className={cn(
                  "w-24 shrink-0 text-[11px]",
                  n === 0 ? "text-muted-foreground/40" : "text-muted-foreground",
                )}
              >
                {HEART_LABEL[cat]}
              </span>
              <div className="flex flex-1 items-center gap-2">
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  {n > 0 && (
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full",
                        HEART_BAR_FILL[cat],
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "w-4 shrink-0 text-right text-xs tabular-nums",
                    n === 0
                      ? "text-muted-foreground/30"
                      : "font-semibold text-foreground",
                  )}
                >
                  {n}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
