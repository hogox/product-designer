// Compuerta humana (enmarcar): el agente propone, el humano aprueba. Nunca se automatiza.
// Aprobar sube versión (commit + historial); iterar registra feedback. Bloquea si la
// verificación tiene criterios bloqueantes sin pasar.

import type { Spec } from "@pda/spec";

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
    <div className="panel">
      <h2>
        Compuerta humana{" "}
        <span className={`badge ${pending ? "real" : "mock"}`}>
          {pending ? "activa" : "inactiva"}
        </span>
      </h2>
      <div className="gate-box">
        <div className="gate-title">Compuerta: {gateName}</div>
        <div className="meta">
          {pending
            ? "Aprobar el problema enmarcado sube la spec de versión (commit + historial). Iterar re-corre el agente con tu feedback."
            : "No hay propuesta pendiente. Corré la etapa (orchestrator define) para generar una v+1."}
        </div>
        {pending && blockingFail && (
          <div className="meta error" style={{ marginTop: 6 }}>
            Hay criterios bloqueantes sin pasar: la aprobación está bloqueada.
          </div>
        )}
        <div className="gate-actions">
          <button
            className="gate approve"
            disabled={!pending || blockingFail}
            style={{
              cursor: pending && !blockingFail ? "pointer" : "not-allowed",
            }}
            onClick={approve}
          >
            Aprobar
          </button>
          <button
            className="gate iterate"
            disabled={!pending}
            style={{ cursor: pending ? "pointer" : "not-allowed" }}
            onClick={iterate}
          >
            Iterar
          </button>
        </div>
      </div>
    </div>
  );
}
