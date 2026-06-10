import { NavLink, useParams } from "react-router-dom";

import type { StageSection } from "../stages";
import { specPath } from "../nav";

export function SectionTabs({
  stageId,
  sections,
}: {
  stageId: string;
  sections: StageSection[];
}) {
  const { specId } = useParams();
  return (
    <div className="tabs">
      {sections.map((sec) => (
        <NavLink
          key={sec.id}
          to={specPath(specId, `/etapa/${stageId}/${sec.id}`)}
          className={({ isActive }) => `tab${isActive ? " active" : ""}`}
        >
          {sec.label}
        </NavLink>
      ))}
    </div>
  );
}
