import type { ReactNode } from "react";
import type { Spec } from "@pda/spec";

import { Section } from "./Section";

function newBadge(isProposal: boolean, cond: boolean): ReactNode {
  return isProposal && cond ? <span className="badge real">nuevo</span> : null;
}

export function Framing({
  shown,
  current,
  isProposal,
}: {
  shown: Spec;
  current: Spec | null;
  isProposal: boolean;
}) {
  return (
    <div className="panel">
      <h2>
        Enmarcado{" "}
        {isProposal && <span className="badge real">propuesta v+1</span>}
      </h2>

      <Section
        title="Problem statement"
        badge={newBadge(isProposal, !current?.problem_statement)}
      >
        <div>{shown.problem_statement ?? "—"}</div>
      </Section>

      <Section
        title="Alcance"
        badge={newBadge(
          isProposal,
          (current?.scope.in_scope.length ?? 0) === 0 &&
            shown.scope.in_scope.length > 0,
        )}
      >
        <div>
          <em>In-scope:</em>{" "}
          {shown.scope.in_scope.length ? (
            <ul className="tight">
              {shown.scope.in_scope.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            "—"
          )}
        </div>
        <div>
          <em>Non-goals:</em>{" "}
          {shown.scope.non_goals.length ? (
            <ul className="tight">
              {shown.scope.non_goals.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            "—"
          )}
        </div>
      </Section>
    </div>
  );
}
