// Metadata ESTÁTICA de navegación de las 7 etapas (PRD §6/§10/§13). Vive en el cliente
// porque es estructura de UI, no datos vivos (esos vienen de la API: spec/findings/audit).

export interface StageSection {
  id: string;
  label: string;
}

export interface StageDef {
  n: number;
  id: string; // slug de ruta
  name: string;
  diamante: "Problema" | "Solución" | "Entrega";
  modo: string;
  gate: string | null;
  real: boolean;
  sections: StageSection[];
  planned?: string[]; // bosquejo para etapas mockeadas (artefactos/secciones planificados)
}

export const STAGES: StageDef[] = [
  {
    n: 1,
    id: "descubrimiento",
    name: "Descubrimiento",
    diamante: "Problema",
    modo: "se potencia",
    gate: null,
    real: true,
    sections: [
      { id: "hallazgos", label: "Hallazgos" },
      { id: "evidencia", label: "Evidencia" },
      { id: "verificacion", label: "Verificación" },
    ],
  },
  {
    n: 2,
    id: "definicion",
    name: "Definición",
    diamante: "Problema",
    modo: "se potencia",
    gate: "enmarcar",
    real: true,
    sections: [
      { id: "enmarcado", label: "Enmarcado" },
      { id: "jtbd", label: "JTBD" },
      { id: "metricas", label: "Métricas" },
      { id: "compuerta", label: "Compuerta" },
    ],
  },
  {
    n: 3,
    id: "exploracion",
    name: "Exploración",
    diamante: "Solución",
    modo: "se reduce",
    gate: null,
    real: false,
    sections: [{ id: "plan", label: "Plan" }],
    planned: [
      "Ideación divergente (skills de ideación)",
      "Wireframes lo-fi",
      "Exploración de alternativas de solución",
    ],
  },
  {
    n: 4,
    id: "diseno",
    name: "Diseño",
    diamante: "Solución",
    modo: "se reduce + automatizable",
    gate: null,
    real: false,
    sections: [{ id: "plan", label: "Plan" }],
    planned: [
      "UI consciente del design system (los 3 roles: restricción/fuente/validador)",
      "Estados y edge-cases",
      "UX writing",
      "Accesibilidad (WCAG 2.2 AA), chequeos automatizables (contraste, tokens)",
    ],
  },
  {
    n: 5,
    id: "validacion",
    name: "Validación",
    diamante: "Solución",
    modo: "mixto",
    gate: "curar",
    real: false,
    sections: [{ id: "plan", label: "Plan" }],
    planned: [
      "Planes de usabilidad",
      "SUS / SEQ",
      "Prototipos de prueba",
      "Compuerta: curar (la solución elegida es la correcta)",
    ],
  },
  {
    n: 6,
    id: "entrega",
    name: "Entrega",
    diamante: "Entrega",
    modo: "automatizable",
    gate: null,
    real: false,
    sections: [{ id: "plan", label: "Plan" }],
    planned: [
      "Handoff-spec / redlines",
      "Design-QA",
      "Auditoría de accesibilidad",
    ],
  },
  {
    n: 7,
    id: "aprendizaje",
    name: "Aprendizaje",
    diamante: "Entrega",
    modo: "se potencia",
    gate: "responder",
    real: false,
    sections: [{ id: "plan", label: "Plan" }],
    planned: [
      "Lectura de métricas post-launch",
      "Readout",
      "Promoción de aprendizajes a la spec",
      "Compuerta: responder (envío seguro y conforme a regulación; control de acceso)",
    ],
  },
];

export function findStage(id: string | undefined): StageDef | undefined {
  return STAGES.find((s) => s.id === id);
}
