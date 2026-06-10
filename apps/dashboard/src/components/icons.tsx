// Mapa de iconos lucide por concepto + contenedor de icono suave (D2 · W3.3/impulso visual).
// El "tinted icon container" (p-2 rounded-lg bg-{c}-50 text-{c}-600) es el patrón visual de
// Stratify para headers de Card/etapa. El icono es gráfico → AA 3:1 (text-{c}-600 sobre -50).
// Centralizar acá evita reimprovisar colores/iconos en cada componente.

import {
  Activity,
  Bot,
  Calculator,
  CircleCheck,
  Compass,
  File,
  FileText,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  MessageSquareQuote,
  PackageCheck,
  PenTool,
  Quote,
  Repeat2,
  Smile,
  Table2,
  Target,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import type { HeartCategory, SourceKind } from "@pda/spec";
import { cn } from "@/lib/utils";

// --- etapa (pipeline de 7) ---
export const STAGE_ICON: Record<string, LucideIcon> = {
  descubrimiento: Compass,
  definicion: Target,
  exploracion: Lightbulb,
  diseno: PenTool,
  validacion: FlaskConical,
  entrega: PackageCheck,
  aprendizaje: GraduationCap,
};

// --- tipo de fuente (por kind del manifest) ---
export const SOURCE_KIND_ICON: Record<SourceKind, LucideIcon> = {
  documento: FileText,
  datos: Table2,
  entrevista: MessageSquareQuote,
  otro: File,
};

// --- tipo de evidencia ---
export const EVIDENCE_ICON = { cita: Quote, cálculo: Calculator } as const;

// --- categoría HEART ---
export const HEART_ICON: Record<HeartCategory, LucideIcon> = {
  happiness: Smile,
  engagement: Activity,
  adoption: UserPlus,
  retention: Repeat2,
  task_success: CircleCheck,
};

// --- auditoría: icono de agente (los humanos usan Avatar con iniciales) ---
export const AgentIcon = Bot;

/** Tono del contenedor de icono por concepto de la card. */
export type IconTone =
  | "primary"
  | "emerald"
  | "amber"
  | "sky"
  | "violet"
  | "rose"
  | "slate";

const TONE_CLS: Record<IconTone, string> = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-muted text-muted-foreground",
};

/** Icono lucide en contenedor suave para headers de Card/etapa (patrón Stratify). */
export function SectionIcon({
  icon: Icon,
  tone = "primary",
  className,
}: {
  icon: LucideIcon;
  tone?: IconTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg",
        TONE_CLS[tone],
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}
