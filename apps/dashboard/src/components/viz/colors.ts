import type { HeartCategory } from "@pda/spec";

// Centralized color map for viz/ components — mirrors TONE_CLS in icons.tsx.
// Full class strings are static here so Tailwind picks them up in content scanning.

// MetricBar track colors
export const BAR_BASELINE = "bg-violet-300";
export const BAR_GAP_IMPROVE = "bg-emerald-200";
export const BAR_GAP_REDUCE = "bg-amber-200";
export const BAR_MARKER_BASELINE = "bg-violet-600/60";
export const BAR_LABEL_IMPROVE = "text-emerald-700 font-medium";
export const BAR_LABEL_NEUTRAL = "text-muted-foreground";

// CategoryBar per-HEART fill and icon text colors
export const HEART_BAR_FILL: Record<HeartCategory, string> = {
  happiness: "bg-rose-400",
  engagement: "bg-amber-400",
  adoption: "bg-sky-400",
  retention: "bg-violet-400",
  task_success: "bg-emerald-400",
};

export const HEART_ICON_TEXT: Record<HeartCategory, string> = {
  happiness: "text-rose-500",
  engagement: "text-amber-500",
  adoption: "text-sky-500",
  retention: "text-violet-500",
  task_success: "text-emerald-500",
};
