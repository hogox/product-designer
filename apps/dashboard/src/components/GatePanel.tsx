// Compuerta humana (enmarcar): el agente propone, el humano aprueba. Nunca se automatiza.
// Aprobar sube versión (commit + historial); iterar registra feedback. Bloquea si la
// verificación tiene criterios bloqueantes sin pasar.

import { UserCheck } from "lucide-react";

import type { Spec } from "@pda/spec";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionIcon } from "./icons";
import { postJson } from "../api";

export function GatePanel({
  specId,
  proposed,
  gateName = "enmarcar",
  onChange,
}: {
  specId: string | null;
  proposed: Spec | null;
  gateName?: string;
  onChange: () => void;
}) {
  const pending = proposed !== null;
  const blockingFail =
    proposed?.verification.some((c) => c.blocking && c.status !== "pass") ??
    false;

  async function approve() {
    if (!specId) return;
    const approver = window.prompt(
      "Aprobar la compuerta como (rol: lead de diseño / PM):",
    );
    if (!approver) return;
    const res = await postJson(`/api/gate/${specId}/approve`, { approver });
    if (res.ok) onChange();
    else alert((await res.json()).error);
  }

  async function iterate() {
    if (!specId) return;
    const feedback = window.prompt(
      "Feedback para iterar (entra como input del agente):",
    );
    if (!feedback) return;
    const res = await postJson(`/api/gate/${specId}/iterate`, {
      feedback,
      actor: "Lead de diseño",
    });
    if (res.ok) onChange();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <SectionIcon icon={UserCheck} tone="amber" />
          Compuerta humana
          {pending ? (
            <Badge variant="aprobado">activa</Badge>
          ) : (
            <Badge variant="secondary">inactiva</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-4">
          <div className="font-semibold">Compuerta: {gateName}</div>
          <p className="text-sm text-muted-foreground">
            {pending
              ? "Aprobar el problema enmarcado sube la spec de versión (commit + historial). Iterar re-corre el agente con tu feedback."
              : "No hay propuesta pendiente. Corré la etapa (orchestrator define) para generar una v+1."}
          </p>
          {pending && blockingFail && (
            <p className="text-sm text-destructive">
              Hay criterios bloqueantes sin pasar: la aprobación está bloqueada.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!pending || blockingFail} onClick={approve}>
              Aprobar
            </Button>
            <Button variant="outline" disabled={!pending} onClick={iterate}>
              Iterar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
