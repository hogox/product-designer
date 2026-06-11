// Wizard de creación de spec (D2 · W6.3): 5 pasos, todo en cliente hasta el paso 5.
// Ruta /nueva: reemplaza el modal legacy (NewSpecModal eliminado). Cancelar vuelve a la
// home sin residuos (nada se crea hasta el paso 5). Stepper propio, sin deps nuevas.
//
// Creación atómica (paso 5 "Crear"):
//   1. POST /api/specs            → spec v0 vacía
//   2. PATCH …/intake             → enmarcado (si hay pregunta)
//   3. POST …/sources ×N          → archivos staged
//   4. navigate → /spec/:id
// Auditoría: spec.create + intake.update + source.upload×N, todos con actorLabel(user).

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, UploadCloud, X } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  postJson,
  patchIntake,
  uploadSource,
  getSpecGroups,
  type SpecIndexEntry,
} from "../api";
import { actorLabel, useSession } from "../session";
import { specPath } from "../nav";
import {
  EnmarcadoFields,
  PlanFields,
  INTAKE_DRAFT_EMPTY,
  type IntakeDraft,
} from "../components/IntakeFormSteps";

const STEP_LABELS = ["Identidad", "Enmarcado", "Plan", "Fuentes", "Crear"];

function WizardStepper({ current }: { current: number }) {
  return (
    <div className="flex items-start">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex flex-1 items-start">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium",
                  done &&
                    "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-background text-primary",
                  !done &&
                    !active &&
                    "border-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : n}
              </div>
              <span
                className={cn(
                  "mt-1 max-w-[4.5rem] text-center text-xs leading-tight",
                  active && "font-medium text-foreground",
                  !active && "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={cn(
                  "mx-1 mt-4 h-0.5 flex-1",
                  done ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface WizardState {
  step: number;
  name: string;
  product: string;
  description: string;
  intake: IntakeDraft;
  files: File[];
}

const INITIAL: WizardState = {
  step: 1,
  name: "",
  product: "",
  description: "",
  intake: INTAKE_DRAFT_EMPTY,
  files: [],
};

export function NewSpecWizard() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [state, setState] = useState<WizardState>(INITIAL);
  const [products, setProducts] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSpecGroups()
      .then((groups) => setProducts(groups.map((g) => g.product)))
      .catch(() => {});
  }, []);

  function patch(p: Partial<WizardState>) {
    setState((s) => ({ ...s, ...p }));
  }

  function patchIntakeDraft(p: Partial<IntakeDraft>) {
    setState((s) => ({ ...s, intake: { ...s.intake, ...p } }));
  }

  function addFiles(incoming: FileList | File[]) {
    const next = [...state.files];
    for (const f of Array.from(incoming)) {
      if (!next.some((x) => x.name === f.name && x.size === f.size))
        next.push(f);
    }
    patch({ files: next });
  }

  function removeFile(i: number) {
    patch({ files: state.files.filter((_, j) => j !== i) });
  }

  // Requisitos para "Siguiente" en cada paso (índice 0 = paso 1)
  const canProceed = [
    state.name.trim().length > 0 && state.product.trim().length > 0,
    state.intake.researchQuestion.trim().length > 0,
    true,
    true,
    true,
  ];

  async function create() {
    setCreating(true);
    setError(null);
    const by = actorLabel(user);
    try {
      // 1. Crear spec v0
      const res = await postJson("/api/specs", {
        name: state.name.trim(),
        product: state.product.trim(),
        description: state.description.trim() || null,
        by,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? `Error ${res.status}`);
        return;
      }
      const entry = (await res.json()) as SpecIndexEntry;
      const id = entry.id;

      // 2. Intake (si hay pregunta)
      if (state.intake.researchQuestion.trim()) {
        await patchIntake(
          id,
          {
            researchQuestion: state.intake.researchQuestion.trim(),
            hypotheses: state.intake.hypotheses.filter((h) => h.trim()),
            productContext: state.intake.productContext.trim() || null,
            discoveryPlan: {
              methods: state.intake.methods,
              instruments: state.intake.instruments,
              expectedSourceKinds: state.intake.expectedSourceKinds,
            },
          },
          by,
        );
      }

      // 3. Fuentes
      for (const file of state.files) {
        await uploadSource(id, file, { by });
      }

      navigate(specPath(id));
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  }

  const { step } = state;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nueva spec</h1>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          aria-label="Cancelar"
        >
          <X className="size-4" />
          Cancelar
        </Button>
      </div>
      <p className="mb-8 text-sm text-muted-foreground">
        Un contrato versionado con sus propias fuentes, hallazgos y auditoría.
      </p>

      <WizardStepper current={step} />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">
            {step}. {STEP_LABELS[step - 1]}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <Step1Identidad
              state={state}
              products={products}
              onChange={patch}
            />
          )}
          {step === 2 && (
            <EnmarcadoFields
              draft={state.intake}
              onChange={patchIntakeDraft}
            />
          )}
          {step === 3 && (
            <PlanFields draft={state.intake} onChange={patchIntakeDraft} />
          )}
          {step === 4 && (
            <Step4Fuentes
              files={state.files}
              dragOver={dragOver}
              fileInputRef={fileInputRef}
              onDragOver={setDragOver}
              onAdd={addFiles}
              onRemove={removeFile}
            />
          )}
          {step === 5 && (
            <Step5Resumen
              state={state}
              creating={creating}
              error={error}
              onCreate={create}
            />
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={step === 1}
          onClick={() => patch({ step: step - 1 })}
        >
          Atrás
        </Button>
        {step < STEP_LABELS.length && (
          <Button
            type="button"
            disabled={!canProceed[step - 1]}
            onClick={() => patch({ step: step + 1 })}
          >
            Siguiente
          </Button>
        )}
      </div>
    </div>
  );
}

function Step1Identidad({
  state,
  products,
  onChange,
}: {
  state: WizardState;
  products: string[];
  onChange: (p: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="spec-name">
          Nombre del problema <span className="text-destructive">*</span>
        </Label>
        <Input
          id="spec-name"
          autoFocus
          value={state.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Reducir el abandono en el checkout"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="spec-product">
          Producto <span className="text-destructive">*</span>
        </Label>
        <Input
          id="spec-product"
          list="product-options"
          value={state.product}
          onChange={(e) => onChange({ product: e.target.value })}
          placeholder="Onboarding, Pagos…"
        />
        <datalist id="product-options">
          {products.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="spec-desc">
          Descripción{" "}
          <span className="text-xs text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="spec-desc"
          rows={2}
          value={state.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
    </div>
  );
}

function Step4Fuentes({
  files,
  dragOver,
  fileInputRef,
  onDragOver,
  onAdd,
  onRemove,
}: {
  files: File[];
  dragOver: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onDragOver: (v: boolean) => void;
  onAdd: (files: FileList | File[]) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Los archivos se suben al crear la spec (paso 5). Podés agregar más desde
        el hub de Fuentes después.
      </p>
      <div
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40",
          dragOver && "border-primary bg-primary/5 text-foreground",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOver(true);
        }}
        onDragLeave={() => onDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          onDragOver(false);
          if (e.dataTransfer.files.length) onAdd(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onAdd(e.target.files);
            e.target.value = "";
          }}
        />
        <UploadCloud className="size-6" />
        Arrastrá archivos acá o hacé clic para seleccionar
        <div className="text-xs">PDF · XLSX · CSV · TXT · DOCX</div>
      </div>
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <span className="truncate">{f.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => onRemove(i)}
                aria-label="Quitar archivo"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Step5Resumen({
  state,
  creating,
  error,
  onCreate,
}: {
  state: WizardState;
  creating: boolean;
  error: string | null;
  onCreate: () => void;
}) {
  const { intake } = state;
  const hypotheses = intake.hypotheses.filter((h) => h.trim());

  return (
    <div className="space-y-4">
      <SummaryRow label="Nombre" value={state.name} />
      <SummaryRow label="Producto" value={state.product} />
      {state.description && (
        <SummaryRow label="Descripción" value={state.description} />
      )}

      <div className="border-t pt-4">
        <SummaryRow
          label="Pregunta"
          value={intake.researchQuestion || "— (sin enmarcado)"}
        />
        {hypotheses.length > 0 && (
          <div className="mt-2">
            <div className="text-xs font-medium text-muted-foreground">
              Hipótesis ({hypotheses.length})
            </div>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
              {hypotheses.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>
        )}
        {intake.productContext && (
          <div className="mt-2 text-sm text-muted-foreground">
            {intake.productContext}
          </div>
        )}
      </div>

      {(intake.methods.length > 0 ||
        intake.instruments.length > 0 ||
        intake.expectedSourceKinds.length > 0) && (
        <div className="space-y-1.5 border-t pt-4">
          {intake.methods.length > 0 && (
            <SummaryRow label="Métodos" value={intake.methods.join(", ")} />
          )}
          {intake.instruments.length > 0 && (
            <SummaryRow
              label="Instrumentos"
              value={intake.instruments.join(", ")}
            />
          )}
          {intake.expectedSourceKinds.length > 0 && (
            <SummaryRow
              label="Fuentes esperadas"
              value={intake.expectedSourceKinds.join(", ")}
            />
          )}
        </div>
      )}

      {state.files.length > 0 && (
        <div className="border-t pt-4">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
            Archivos ({state.files.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {state.files.map((f, i) => (
              <Badge key={i} variant="outline" className="font-mono text-xs">
                {f.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">Error: {error}</p>}

      <div className="border-t pt-4">
        <Button
          type="button"
          disabled={creating || !state.name.trim() || !state.product.trim()}
          onClick={onCreate}
          className="w-full"
        >
          {creating ? "Creando…" : "Crear spec"}
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{value}</span>
    </div>
  );
}
