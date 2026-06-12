// Banner de sugerencia con IA para el enmarcado (Sesión 17).
// Llama a POST /api/intake/suggest, prelena el draft y permite regenerar.
// El servidor no persiste nada; el humano edita lo que quiere antes de guardar.

import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { suggestIntakeDraft } from "../api";
import type { IntakeDraft } from "./IntakeFormSteps";

interface IntakeSuggestBannerProps {
  name: string;
  product: string;
  description: string | null;
  onFill: (patch: Partial<IntakeDraft>) => void;
}

export function IntakeSuggestBanner({
  name,
  product,
  description,
  onFill,
}: IntakeSuggestBannerProps) {
  const [phase, setPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [tokenTotal, setTokenTotal] = useState<number | null>(null);

  async function suggest() {
    setPhase("loading");
    setError(null);
    try {
      const { draft, usage } = await suggestIntakeDraft(name, product, description);
      onFill({
        researchQuestion: draft.researchQuestion,
        hypotheses: draft.hypotheses,
        productContext: draft.productContext ?? "",
        methods: draft.methods,
        instruments: draft.instruments,
        expectedSourceKinds: draft.expectedSourceKinds,
      });
      setTokenTotal(usage.total);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="size-3.5 animate-spin" />
        Generando sugerencia…
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1 font-medium text-primary">
          <Sparkles className="size-3" />
          Sugerido por IA
        </span>
        {tokenTotal !== null && <span>· {tokenTotal} tokens</span>}
        <button
          type="button"
          onClick={suggest}
          className="ml-auto underline-offset-2 hover:underline"
        >
          Regenerar
        </button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive">
        <span className="flex-1 truncate">{error}</span>
        <button
          type="button"
          onClick={suggest}
          className="shrink-0 underline-offset-2 hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5 self-start"
      onClick={suggest}
    >
      <Sparkles className="size-3.5" />
      Sugerir con IA
    </Button>
  );
}
