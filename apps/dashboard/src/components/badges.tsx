// Chips semánticos PROVISORIOS (D2 · W3.2): composición sobre el Badge stock con
// clases Tailwind (ANEXO §1: los semánticos NO son tokens). En la sesión 8 (W3.3)
// migran a variantes cva dentro de components/ui/badge.tsx — la única edición
// permitida de components/ui/.

import { Badge } from "@/components/ui/badge";
import type { ReviewStatus } from "../api";

/** Etiquetado real/mock (invariante U-3): visible en todas las vistas. */
export function RealMockBadge({ real }: { real: boolean }) {
  return real ? (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-emerald-700"
    >
      real
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-amber-200 bg-amber-50 text-amber-700"
    >
      mock
    </Badge>
  );
}

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  en_pausa: "En pausa",
};

const REVIEW_STYLES: Record<ReviewStatus, string> = {
  aprobado: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rechazado: "border-red-200 bg-red-50 text-red-700",
  en_pausa: "border-amber-200 bg-amber-50 text-amber-700",
  pendiente: "border-border bg-muted text-muted-foreground",
};

/** Estado de revisión por hallazgo (W2.4): verde/rojo/ámbar/gris semánticos. */
export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <Badge variant="outline" className={REVIEW_STYLES[status]}>
      {REVIEW_LABEL[status]}
    </Badge>
  );
}

/** Confianza del hallazgo: high (verde) bloquea el gate; medium/low en ámbar. */
export function ConfidenceBadge({ confidence }: { confidence: string }) {
  return (
    <Badge
      variant="outline"
      className={
        confidence === "high"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }
    >
      {confidence}
    </Badge>
  );
}

/** Tipo de evidencia anclada: cita (texto) en sky, cálculo (tabular) en violet. */
export function EvidenceKindBadge({ kind }: { kind: "cita" | "cálculo" }) {
  return (
    <Badge
      variant="outline"
      className={
        kind === "cita"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-violet-200 bg-violet-50 text-violet-700"
      }
    >
      {kind}
    </Badge>
  );
}
