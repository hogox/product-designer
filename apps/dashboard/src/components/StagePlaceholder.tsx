// Página de etapa MOCKEADA: comunica la visión completa del pipeline mostrando el plan de
// la etapa (artefactos/secciones/gate planificados, del PRD). Etiquetada como mock.
// Migrado a shadcn/Tailwind (impulso visual): Card + Badge variantes.

import { Construction } from "lucide-react";

import type { StageDef } from "../stages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionIcon } from "./icons";

export function StagePlaceholder({ stage }: { stage: StageDef }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <SectionIcon icon={Construction} tone="amber" />
          Etapa mockeada
          <Badge variant="mock">mock</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Esta etapa todavía no está implementada (llega en Fase 3+). El motor
          real son por ahora Descubrimiento y Definición. Abajo, el plan de esta
          etapa según el PRD.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <section className="space-y-1.5">
          <h3 className="font-medium">Artefactos y secciones planificados</h3>
          {stage.planned && stage.planned.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {stage.planned.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground italic">Por definir.</p>
          )}
        </section>

        {stage.gate && (
          <section className="space-y-1.5">
            <h3 className="font-medium">Compuerta al cierre</h3>
            <div className="flex items-center gap-2">
              <Badge variant="enPausa">{stage.gate}</Badge>
              <span className="text-muted-foreground">
                (human-led; el agente propone, el humano aprueba)
              </span>
            </div>
          </section>
        )}

        <section className="space-y-1.5">
          <h3 className="font-medium">Contrato de etapa (§8)</h3>
          <p className="text-muted-foreground">
            recolectar → extraer evidencia → derivar → validar (humano) →
            sintetizar → compuerta. El invariante de procedencia no cambia: toda
            afirmación cita su fuente.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
