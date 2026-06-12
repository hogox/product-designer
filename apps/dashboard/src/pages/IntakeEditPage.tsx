// Retrofit del enmarcado (D2 · W6.4): edita la sección `intake` de una spec existente.
// Ruta /spec/:id/intake (dentro del shell de spec). Reusa los pasos 2–3 del wizard.
// Usa PATCH …/intake (audita intake.update). Si la spec no tiene intake, arranca vacío.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { patchIntake } from "../api";
import { actorLabel, useSession } from "../session";
import { specPath } from "../nav";
import { useShell } from "../App";
import {
  EnmarcadoFields,
  PlanFields,
  INTAKE_DRAFT_EMPTY,
  draftFromIntake,
  type IntakeDraft,
} from "../components/IntakeFormSteps";
import { IntakeSuggestBanner } from "../components/IntakeSuggestBanner";

export function IntakeEditPage() {
  const { specId, spec, refetch } = useShell();
  const { user } = useSession();
  const initialized = useRef(false);
  const [draft, setDraft] = useState<IntakeDraft>(INTAKE_DRAFT_EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inicializar con el intake existente (una vez, cuando la spec carga)
  useEffect(() => {
    if (spec && !initialized.current) {
      initialized.current = true;
      setDraft(spec.intake ? draftFromIntake(spec.intake) : INTAKE_DRAFT_EMPTY);
    }
  }, [spec]);

  if (!spec || !specId) {
    return <p className="text-sm italic text-muted-foreground">Cargando…</p>;
  }

  function onChange(p: Partial<IntakeDraft>) {
    setDraft((d) => ({ ...d, ...p }));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!specId || !draft.researchQuestion.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await patchIntake(
        specId,
        {
          researchQuestion: draft.researchQuestion.trim(),
          hypotheses: draft.hypotheses.filter((h) => h.trim()),
          productContext: draft.productContext.trim() || null,
          discoveryPlan: {
            methods: draft.methods,
            instruments: draft.instruments,
            expectedSourceKinds: draft.expectedSourceKinds,
          },
        },
        actorLabel(user),
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Error ${res.status}`);
        return;
      }
      setSaved(true);
      refetch();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link
        to={specPath(specId)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver al overview
      </Link>

      <h1 className="text-xl font-semibold">Enmarcado del discovery</h1>
      <p className="text-sm text-muted-foreground">
        La pregunta y el plan guían al Agente 1 al priorizar hallazgos (solo en
        la derivación, nunca en la extracción — invariante 3).
      </p>

      <form onSubmit={save} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enmarcado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <IntakeSuggestBanner
              name={spec.title}
              product={spec.product}
              description={spec.description ?? null}
              onFill={onChange}
            />
            <EnmarcadoFields draft={draft} onChange={onChange} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan de discovery</CardTitle>
          </CardHeader>
          <CardContent>
            <PlanFields draft={draft} onChange={onChange} />
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">Error: {error}</p>}

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={saving || !draft.researchQuestion.trim()}
          >
            {saving ? "Guardando…" : "Guardar enmarcado"}
          </Button>
          {saved && (
            <span className="text-sm text-emerald-700">Guardado ✓</span>
          )}
        </div>
      </form>
    </div>
  );
}
