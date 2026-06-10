// Tabs de sección por etapa (W3.2): Tabs stock de shadcn sincronizadas con la URL —
// el valor activo sale de :sectionId y el cambio navega (la URL sigue siendo la verdad).

import { useNavigate, useParams } from "react-router-dom";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StageSection } from "../stages";
import { specPath } from "../nav";

export function SectionTabs({
  stageId,
  sections,
}: {
  stageId: string;
  sections: StageSection[];
}) {
  const { specId, sectionId } = useParams();
  const navigate = useNavigate();
  return (
    <Tabs
      value={sectionId ?? sections[0]!.id}
      onValueChange={(v) =>
        navigate(specPath(specId, `/etapa/${stageId}/${v}`))
      }
    >
      <TabsList>
        {sections.map((sec) => (
          <TabsTrigger key={sec.id} value={sec.id}>
            {sec.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
