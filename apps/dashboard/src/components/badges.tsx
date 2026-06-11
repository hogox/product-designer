// Chips semánticos (D2 · W3.3): delegan TODO el color a las variantes cva de Badge
// (components/ui/badge.tsx, la única edición permitida de ui/). Acá vive solo el mapeo
// concepto → variante + etiqueta/icono. Cero clases de color sueltas (ANEXO §3).

import { Badge } from "@/components/ui/badge";
import type {
  ConceptReviewStatus,
  FindingType,
  HeartCategory,
  ReviewStatus,
  SourceKind,
} from "@pda/spec";
import { HEART_ICON, SOURCE_KIND_ICON } from "./icons";

/** Etiquetado real/mock (invariante U-3): visible en todas las vistas. */
export function RealMockBadge({ real }: { real: boolean }) {
  return (
    <Badge variant={real ? "real" : "mock"}>{real ? "real" : "mock"}</Badge>
  );
}

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  en_pausa: "En pausa",
};

const REVIEW_VARIANT: Record<ReviewStatus, "aprobado" | "rechazado" | "enPausa" | "pendiente"> = {
  aprobado: "aprobado",
  rechazado: "rechazado",
  en_pausa: "enPausa",
  pendiente: "pendiente",
};

/** Estado de revisión por hallazgo (W2.4): verde/rojo/ámbar/gris semánticos. */
export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <Badge variant={REVIEW_VARIANT[status]}>{REVIEW_LABEL[status]}</Badge>;
}

/** Confianza del hallazgo: high (verde) bloquea el gate; medium/low en ámbar. */
export function ConfidenceBadge({ confidence }: { confidence: string }) {
  return (
    <Badge variant={confidence === "high" ? "aprobado" : "enPausa"}>
      {confidence}
    </Badge>
  );
}

/** Tipo de evidencia anclada: cita (texto) en sky, cálculo (tabular) en violet. */
export function EvidenceKindBadge({ kind }: { kind: "cita" | "cálculo" }) {
  return (
    <Badge variant={kind === "cita" ? "cita" : "calculo"}>{kind}</Badge>
  );
}

/** Tipo de hallazgo: quantitative (indigo) vs qualitative (teal). */
export function FindingTypeBadge({ type }: { type: FindingType }) {
  return <Badge variant={type}>{type}</Badge>;
}

/** Categoría HEART con su icono (métricas de Definición). */
export function HeartBadge({ category }: { category: HeartCategory }) {
  const Icon = HEART_ICON[category];
  return (
    <Badge variant="heart">
      <Icon className="size-3" />
      {category}
    </Badge>
  );
}

const CONCEPT_REVIEW_LABEL: Record<ConceptReviewStatus, string> = {
  propuesto: "Propuesto",
  seleccionado: "Seleccionado",
  descartado: "Descartado",
};
const CONCEPT_REVIEW_VARIANT: Record<ConceptReviewStatus, "pendiente" | "aprobado" | "rechazado"> = {
  propuesto: "pendiente",
  seleccionado: "aprobado",
  descartado: "rechazado",
};

/** Estado de revisión de un concepto de solución (Exploración, F3-A). */
export function ConceptReviewStatusBadge({ status }: { status: ConceptReviewStatus }) {
  return <Badge variant={CONCEPT_REVIEW_VARIANT[status]}>{CONCEPT_REVIEW_LABEL[status]}</Badge>;
}

/** Tipo de fuente con su icono (página Fuentes). */
export function SourceKindBadge({ kind }: { kind: SourceKind }) {
  const Icon = SOURCE_KIND_ICON[kind];
  return (
    <Badge variant="outline" className="capitalize">
      <Icon className="size-3" />
      {kind}
    </Badge>
  );
}
