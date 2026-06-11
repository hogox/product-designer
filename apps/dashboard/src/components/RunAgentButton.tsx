// Disparo de un agente desde la UI (Sesión 16): preflight de costo → confirmación si ya corrió
// → POST → polling del estado. Reusable para discover/define/explore. La key vive en el server;
// acá solo disparamos y observamos. Nunca re-corre sin confirmación (guarda de doble corrida).

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  getRunPreflight,
  startRun,
  getRunStatus,
  type AgentName,
  type Preflight,
  type AgentRunSummary,
  type TokenUsage,
} from "../api";
import { actorLabel, canRunAgents, useSession } from "../session";

type Phase = "idle" | "confirming" | "running" | "done" | "error";

function summarize(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(" · ");
}

function tokensLabel(t?: TokenUsage): string {
  if (!t || t.total === 0) return "";
  const cache = t.cacheHits ? ` · ${t.cacheHits} en cache` : "";
  return ` · ${t.total.toLocaleString()} tokens${cache}`;
}

/** Texto del Dialog de confirmación, derivado del preflight (costo + qué se pierde). */
function ConfirmBody({ preflight }: { preflight: Preflight }) {
  if (preflight.agent === "discover") {
    const nothingChanged = preflight.toExtract === 0;
    return (
      <div className="space-y-2 text-sm">
        <p>
          Ya hay hallazgos de una corrida previa. <strong>Re-correr los
          reemplaza</strong> (perdés el triage actual).
        </p>
        <ul className="space-y-1 text-muted-foreground">
          <li>
            • {preflight.toExtract} de {preflight.textSources} fuentes de texto se
            re-extraen
            {preflight.cached > 0 && (
              <> ({preflight.cached} ya en cache, 0 tokens)</>
            )}
            .
          </li>
          {preflight.tabular > 0 && (
            <li>• {preflight.tabular} tabulares (cómputo, 0 tokens).</li>
          )}
          <li>• 1 derivación (siempre gasta tokens).</li>
        </ul>
        {nothingChanged && (
          <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Nada cambió desde la última corrida: solo se re-derivaría (los
            hallazgos pueden variar levemente).
          </p>
        )}
      </div>
    );
  }
  if (preflight.agent === "explore") {
    return (
      <div className="space-y-2 text-sm">
        <p>
          Ya hay conceptos en triage. Re-correr <strong>conserva los
          seleccionados y descartados</strong> y agrega nuevos propuestos (merge,
          no se pierde nada). Cuesta 1 llamada al modelo.
        </p>
      </div>
    );
  }
  // define
  return (
    <div className="space-y-2 text-sm">
      <p>
        Ya hay una propuesta de Definición pendiente.{" "}
        <strong>Re-correr la reemplaza.</strong> Cuesta 1 llamada al modelo.
      </p>
    </div>
  );
}

export function RunAgentButton({
  specId,
  agent,
  label,
  onDone,
}: {
  specId: string | null;
  agent: AgentName;
  label: string;
  onDone: () => void;
}) {
  const { user } = useSession();
  const [phase, setPhase] = useState<Phase>("idle");
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [result, setResult] = useState<AgentRunSummary | null>(null);
  const [tokens, setTokens] = useState<TokenUsage | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const launch = useCallback(async () => {
    if (!specId) return;
    setError(null);
    setPhase("running");
    const res = await startRun(specId, agent, actorLabel(user));
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Error al arrancar la corrida");
      setPhase("error");
    }
    // si arrancó OK (202), el polling toma el control
  }, [specId, agent, user]);

  // polling del estado mientras corre
  useEffect(() => {
    if (phase !== "running" || !specId) return;
    let active = true;
    const iv = setInterval(async () => {
      try {
        const st = await getRunStatus(specId, agent);
        if (!active) return;
        if (st.status === "done") {
          setResult(st.result ?? null);
          setTokens(st.tokens);
          setPhase("done");
          onDone();
          clearInterval(iv);
        } else if (st.status === "error") {
          setError(st.error ?? "La corrida falló");
          setPhase("error");
          clearInterval(iv);
        }
      } catch {
        /* reintenta en el próximo tick */
      }
    }, 1500);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [phase, specId, agent, onDone]);

  async function onClick() {
    if (!specId) return;
    try {
      const pf = await getRunPreflight(specId, agent);
      setPreflight(pf);
      if (pf.alreadyRan) {
        setPhase("confirming");
      } else {
        await launch();
      }
    } catch (e) {
      setError(String(e));
      setPhase("error");
    }
  }

  const running = phase === "running";
  const allowed = canRunAgents(user);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={onClick}
        disabled={running || !specId || !allowed}
        title={allowed ? undefined : "Necesitás rol de operador para correr agentes"}
      >
        {running ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Play className="size-4" />
        )}
        {label}
      </Button>

      {running && (
        <span className="text-sm text-muted-foreground">corriendo…</span>
      )}
      {phase === "done" && result && (
        <span className="flex items-center gap-1.5 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" />
          {summarize(result.counts)}
          {tokensLabel(tokens)}
        </span>
      )}
      {phase === "error" && error && (
        <span className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertTriangle className="size-4" />
          {error}
        </span>
      )}

      {/* confirmación de re-corrida (guarda de doble corrida) */}
      <Dialog
        open={phase === "confirming"}
        onOpenChange={(o) => !o && setPhase("idle")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}: ya corrió antes</DialogTitle>
            <DialogDescription>
              Revisá el costo antes de volver a gastar tokens.
            </DialogDescription>
          </DialogHeader>
          {preflight && <ConfirmBody preflight={preflight} />}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={() => void launch()}>Correr igual</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
