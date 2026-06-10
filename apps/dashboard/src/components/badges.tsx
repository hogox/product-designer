// Chips semánticos PROVISORIOS (D2 · W3.2): composición sobre el Badge stock con
// clases Tailwind (ANEXO §1: los semánticos NO son tokens). En la sesión 8 (W3.3)
// migran a variantes cva dentro de components/ui/badge.tsx — la única edición
// permitida de components/ui/.

import { Badge } from "@/components/ui/badge";

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
