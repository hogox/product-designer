import { cn } from "@/lib/utils";
import {
  parseLeadingNumber,
  deriveDirection,
  type ParsedNumber,
} from "./parseMetric";
import {
  BAR_BASELINE,
  BAR_GAP_IMPROVE,
  BAR_GAP_REDUCE,
  BAR_MARKER_BASELINE,
  BAR_LABEL_IMPROVE,
  BAR_LABEL_NEUTRAL,
} from "./colors";

function fmtDelta(
  b: number,
  t: number,
  unit: "%" | "s" | null,
): string {
  const delta = t - b;
  const abs = Math.abs(delta);
  const sign = delta >= 0 ? "+" : "−";
  const suffix = unit === "%" ? " pp" : unit === "s" ? " s" : "";
  return `${sign}${abs < 10 ? abs.toFixed(1) : Math.round(abs)}${suffix}`;
}

// Renders the track for when both baseline and target have the same parseable unit.
function BarTrack({
  baseline,
  target,
  bPct,
  tPct,
}: {
  baseline: ParsedNumber;
  target: ParsedNumber;
  bPct: number;
  tPct: number;
}) {
  const direction = deriveDirection(target);
  const improving =
    direction === "up"
      ? target.value >= baseline.value
      : target.value <= baseline.value;

  const leftPct = Math.min(bPct, tPct);
  const gapWidth = Math.abs(tPct - bPct);

  const delta = fmtDelta(baseline.value, target.value, baseline.unit);

  // Going up: violet fill (0→baseline) + emerald/amber gap (baseline→target)
  // Going down: emerald "goal zone" (0→target) + amber "excess" (target→baseline)
  const isGoingUp = direction === "up";

  return (
    <div className="space-y-1.5">
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        {isGoingUp ? (
          <>
            <div
              className={cn("absolute inset-y-0 left-0", BAR_BASELINE)}
              style={{ width: `${bPct}%` }}
            />
            <div
              className={cn(
                "absolute inset-y-0",
                improving ? BAR_GAP_IMPROVE : BAR_GAP_REDUCE,
              )}
              style={{ left: `${bPct}%`, width: `${gapWidth}%` }}
            />
          </>
        ) : (
          <>
            <div
              className={cn("absolute inset-y-0 left-0", BAR_GAP_IMPROVE)}
              style={{ width: `${tPct}%` }}
            />
            <div
              className={cn("absolute inset-y-0", BAR_GAP_REDUCE)}
              style={{ left: `${tPct}%`, width: `${gapWidth}%` }}
            />
          </>
        )}
        {/* Baseline marker */}
        <div
          className={cn("absolute inset-y-0 w-px", BAR_MARKER_BASELINE)}
          style={{ left: `${bPct}%` }}
        />
        {/* Target marker */}
        <div
          className="absolute inset-y-0 w-px bg-foreground/40"
          style={{ left: `${tPct}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between text-xs tabular-nums">
        <span className="text-muted-foreground">
          baseline: {baseline.raw}
        </span>
        <span className={cn(improving ? BAR_LABEL_IMPROVE : BAR_LABEL_NEUTRAL)}>
          target: {target.op ?? ""}
          {target.value}
          {target.unit ?? ""} ({delta})
        </span>
      </div>
    </div>
  );
}

export function MetricBar({
  baseline,
  target,
}: {
  baseline: string | null;
  target: string;
}) {
  const bParsed = parseLeadingNumber(baseline);
  const tParsed = parseLeadingNumber(target);

  // Both parse to the same unit → full bar
  if (bParsed && tParsed && bParsed.unit === tParsed.unit) {
    const unit = bParsed.unit;
    const maxVal =
      unit === "%"
        ? 100
        : Math.max(bParsed.value, tParsed.value) * 1.2;
    const bPct = Math.min(100, (bParsed.value / maxVal) * 100);
    const tPct = Math.min(100, (tParsed.value / maxVal) * 100);

    return (
      <BarTrack
        baseline={bParsed}
        target={tParsed}
        bPct={bPct}
        tPct={tPct}
      />
    );
  }

  // Baseline parses as % but target is narrative → partial bar (punto de partida)
  if (bParsed && bParsed.unit === "%") {
    return (
      <div className="space-y-1.5">
        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("absolute inset-y-0 left-0", BAR_BASELINE)}
            style={{ width: `${bParsed.value}%` }}
          />
          <div
            className={cn("absolute inset-y-0 w-px", BAR_MARKER_BASELINE)}
            style={{ left: `${bParsed.value}%` }}
          />
        </div>
        <div className="space-y-0.5 text-xs">
          <span className="text-muted-foreground tabular-nums">
            baseline: {bParsed.raw}
          </span>
          <p className="text-muted-foreground">target: {target}</p>
        </div>
      </div>
    );
  }

  // Text fallback — idéntico al render anterior
  return (
    <p className="text-sm text-muted-foreground">
      baseline: {baseline ?? "—"} → target: {target}
    </p>
  );
}
