// Avatar de actor para la auditoría (D2 · impulso visual, paso 2d): humanos con
// iniciales + color estable por nombre; agentes con variante neutra + icono Bot.
// Pares bg-{c}-100 text-{c}-700 (AA ≥4.5:1 para las iniciales).

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AgentIcon } from "./icons";
import { cn } from "@/lib/utils";

// Un actor es "agente"/sistema si su nombre lo declara (el resto son humanos: Lead PM, etc.).
const AGENT_RE = /agent|agente|\bia\b|bot|modelo|orquestador|orchestrator|sistema|system/i;

const HUMAN_TONES = [
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function toneFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUMAN_TONES[h % HUMAN_TONES.length]!;
}

export function ActorAvatar({
  actor,
  size = "sm",
}: {
  actor: string;
  size?: "sm" | "default" | "lg";
}) {
  const isAgent = AGENT_RE.test(actor);
  return (
    <Avatar size={size} title={actor}>
      <AvatarFallback
        className={cn(
          "font-medium",
          isAgent ? "bg-muted text-muted-foreground" : toneFor(actor),
        )}
      >
        {isAgent ? <AgentIcon className="size-3.5" /> : initials(actor)}
      </AvatarFallback>
    </Avatar>
  );
}
