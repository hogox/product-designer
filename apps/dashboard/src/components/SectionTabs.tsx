import { NavLink } from "react-router-dom";

import type { StageSection } from "../stages";

export function SectionTabs({
  stageId,
  sections,
}: {
  stageId: string;
  sections: StageSection[];
}) {
  return (
    <div className="tabs">
      {sections.map((sec) => (
        <NavLink
          key={sec.id}
          to={`/etapa/${stageId}/${sec.id}`}
          className={({ isActive }) => `tab${isActive ? " active" : ""}`}
        >
          {sec.label}
        </NavLink>
      ))}
    </div>
  );
}
