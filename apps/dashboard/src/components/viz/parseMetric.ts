export type ParsedNumber = {
  op: "≥" | "≤" | "<" | ">" | "~" | null;
  value: number;
  unit: "%" | "s" | null;
  raw: string;
};

// optional comparator + decimal number + optional whitespace + optional unit
const LEADING_NUM = /^([≥≤<>~]?)\s*(\d+(?:[.,]\d+)?)\s*(%|s)?/;

export function parseLeadingNumber(
  s: string | null | undefined,
): ParsedNumber | null {
  if (!s) return null;
  const m = LEADING_NUM.exec(s.trim());
  if (!m) return null;
  const value = parseFloat(m[2].replace(",", "."));
  if (isNaN(value)) return null;
  return {
    op: (m[1] || null) as ParsedNumber["op"],
    value,
    unit: (m[3] ?? null) as ParsedNumber["unit"],
    raw: m[0].trimEnd(),
  };
}

export type Direction = "up" | "down";

// ≤ / < means "lower is better" (reduce abandonment, cut latency, etc.)
export function deriveDirection(p: ParsedNumber | null): Direction {
  if (!p) return "up";
  return p.op === "≤" || p.op === "<" ? "down" : "up";
}

// Non-anchored: finds the FIRST number anywhere in the text.
// Used to extract a key metric from prose (e.g. problem statement).
const IN_TEXT_NUM = /([≥≤<>~]?)(\d+(?:[.,]\d+)?)\s*(%|s)?/;

export function extractFirstNumber(
  s: string | null | undefined,
): ParsedNumber | null {
  if (!s) return null;
  const m = IN_TEXT_NUM.exec(s);
  if (!m) return null;
  const value = parseFloat(m[2].replace(",", "."));
  if (isNaN(value)) return null;
  return {
    op: (m[1] || null) as ParsedNumber["op"],
    value,
    unit: (m[3] ?? null) as ParsedNumber["unit"],
    raw: m[0].trimEnd(),
  };
}
