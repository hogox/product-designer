// Evidencia anclada, agrupada por fuente. Toda evidencia ancla a archivo + locator + cita
// (texto) o cálculo (tabular) — la base anti-alucinación (invariante 5).

import type { Finding } from "@pda/spec";

interface Anchor {
  finding: string;
  locator: string;
  text: string;
  kind: "cita" | "cálculo";
}

export function EvidenceList({ findings }: { findings: Finding[] }) {
  const bySource = new Map<string, Anchor[]>();
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
      <div className="panel">
        <p className="empty">Sin evidencia (no hay hallazgos todavía).</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>
        Evidencia anclada{" "}
        <span className="badge real">{bySource.size} fuentes</span>
      </h2>
      {[...bySource.entries()].map(([source, anchors]) => (
        <div className="section" key={source}>
          <h3>{source}</h3>
          <ul className="tight">
            {anchors.map((a, i) => (
              <li key={i}>
                <span
                  className={`badge ${a.kind === "cálculo" ? "mock" : "real"}`}
                >
                  {a.kind}
                </span>{" "}
                <span className="meta">{a.locator}:</span>{" "}
                {a.kind === "cita" ? `"${a.text}"` : a.text}{" "}
                <span className="meta">({a.finding})</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
