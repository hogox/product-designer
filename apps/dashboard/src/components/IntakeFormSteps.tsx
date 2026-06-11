// Campos reutilizables de enmarcado (pasos 2-3 del wizard y del retrofit).
// Exporta IntakeDraft + helpers de conversión + dos componentes de formulario.

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
// Solo tipos — @pda/spec incluye store.ts que usa node:child_process y no puede
// bundlearse para el browser. deriveExpectedSourceKinds se inlinea debajo.
import type {
  DiscoveryMethod,
  DiscoveryInstrument,
  SourceKind,
} from "@pda/spec";

const METHOD_TO_KINDS: Record<DiscoveryMethod, SourceKind[]> = {
  entrevistas: ["entrevista"],
  encuestas: ["datos"],
  analitica: ["datos"],
  benchmark: ["documento"],
  soporte: ["documento"],
  otros: [],
};

function deriveExpectedSourceKinds(methods: DiscoveryMethod[]): SourceKind[] {
  const set = new Set<SourceKind>();
  for (const m of methods) for (const k of METHOD_TO_KINDS[m]) set.add(k);
  return [...set];
}

export interface IntakeDraft {
  researchQuestion: string;
  hypotheses: string[];
  productContext: string;
  methods: DiscoveryMethod[];
  instruments: DiscoveryInstrument[];
  expectedSourceKinds: SourceKind[];
}

export const INTAKE_DRAFT_EMPTY: IntakeDraft = {
  researchQuestion: "",
  hypotheses: [],
  productContext: "",
  methods: [],
  instruments: [],
  expectedSourceKinds: [],
};

export function draftFromIntake(intake: {
  researchQuestion: string;
  hypotheses: string[];
  productContext: string | null;
  discoveryPlan: {
    methods: DiscoveryMethod[];
    instruments: DiscoveryInstrument[];
    expectedSourceKinds: SourceKind[];
  };
}): IntakeDraft {
  return {
    researchQuestion: intake.researchQuestion,
    hypotheses: intake.hypotheses,
    productContext: intake.productContext ?? "",
    methods: intake.discoveryPlan.methods,
    instruments: intake.discoveryPlan.instruments,
    expectedSourceKinds: intake.discoveryPlan.expectedSourceKinds,
  };
}

const ALL_METHODS: { value: DiscoveryMethod; label: string }[] = [
  { value: "entrevistas", label: "Entrevistas" },
  { value: "encuestas", label: "Encuestas" },
  { value: "analitica", label: "Analítica" },
  { value: "benchmark", label: "Benchmark" },
  { value: "soporte", label: "Soporte" },
  { value: "otros", label: "Otros" },
];

const ALL_INSTRUMENTS: { value: DiscoveryInstrument; label: string }[] = [
  { value: "nps", label: "NPS" },
  { value: "ces", label: "CES" },
  { value: "csat", label: "CSAT" },
  { value: "isn", label: "ISN" },
  { value: "otros", label: "Otros" },
];

const ALL_KINDS: { value: SourceKind; label: string }[] = [
  { value: "documento", label: "Documento" },
  { value: "datos", label: "Datos" },
  { value: "entrevista", label: "Entrevista" },
  { value: "persona", label: "Persona" },
  { value: "otro", label: "Otro" },
];

const pillBase =
  "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors";
const pillOn = "border-primary bg-primary/10 font-medium text-primary";
const pillOff =
  "border-muted-foreground/30 text-muted-foreground hover:border-primary/50";

export function EnmarcadoFields({
  draft,
  onChange,
}: {
  draft: IntakeDraft;
  onChange: (patch: Partial<IntakeDraft>) => void;
}) {
  function addHypothesis() {
    onChange({ hypotheses: [...draft.hypotheses, ""] });
  }
  function updateHypothesis(i: number, v: string) {
    const next = [...draft.hypotheses];
    next[i] = v;
    onChange({ hypotheses: next });
  }
  function removeHypothesis(i: number) {
    onChange({ hypotheses: draft.hypotheses.filter((_, j) => j !== i) });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="rq">
          Pregunta de investigación{" "}
          <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="rq"
          autoFocus
          rows={2}
          value={draft.researchQuestion}
          onChange={(e) => onChange({ researchQuestion: e.target.value })}
          placeholder="¿Por qué los usuarios abandonan el checkout antes de confirmar el pago?"
        />
        <p className="text-xs text-muted-foreground">
          Guía al Agente 1 al priorizar hallazgos.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>
          Hipótesis{" "}
          <span className="text-xs text-muted-foreground">(opcional)</span>
        </Label>
        <div className="space-y-2">
          {draft.hypotheses.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={h}
                onChange={(e) => updateHypothesis(i, e.target.value)}
                placeholder={`Hipótesis ${i + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => removeHypothesis(i)}
                aria-label="Eliminar hipótesis"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addHypothesis}
          >
            <Plus className="size-4" />
            Agregar hipótesis
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ctx">
          Contexto de producto{" "}
          <span className="text-xs text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="ctx"
          rows={2}
          value={draft.productContext}
          onChange={(e) => onChange({ productContext: e.target.value })}
          placeholder="Checkout de e-commerce, ~40 k usuarios/mes, tasa de conversión 23 %…"
        />
      </div>
    </div>
  );
}

export function PlanFields({
  draft,
  onChange,
}: {
  draft: IntakeDraft;
  onChange: (patch: Partial<IntakeDraft>) => void;
}) {
  function toggleMethod(m: DiscoveryMethod) {
    const adding = !draft.methods.includes(m);
    const derivedForM = deriveExpectedSourceKinds([m]);
    if (adding) {
      onChange({
        methods: [...draft.methods, m],
        expectedSourceKinds: [
          ...new Set([...draft.expectedSourceKinds, ...derivedForM]),
        ],
      });
    } else {
      const nextMethods = draft.methods.filter((x) => x !== m);
      const stillDerived = deriveExpectedSourceKinds(nextMethods);
      const toRemove = derivedForM.filter((k) => !stillDerived.includes(k));
      onChange({
        methods: nextMethods,
        expectedSourceKinds: draft.expectedSourceKinds.filter(
          (k) => !toRemove.includes(k),
        ),
      });
    }
  }

  function toggleInstrument(ins: DiscoveryInstrument) {
    onChange({
      instruments: draft.instruments.includes(ins)
        ? draft.instruments.filter((x) => x !== ins)
        : [...draft.instruments, ins],
    });
  }

  function toggleKind(k: SourceKind) {
    onChange({
      expectedSourceKinds: draft.expectedSourceKinds.includes(k)
        ? draft.expectedSourceKinds.filter((x) => x !== k)
        : [...draft.expectedSourceKinds, k],
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Métodos de discovery</Label>
        <div className="flex flex-wrap gap-2">
          {ALL_METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => toggleMethod(m.value)}
              className={cn(
                pillBase,
                draft.methods.includes(m.value) ? pillOn : pillOff,
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>
          Instrumentos de satisfacción{" "}
          <span className="text-xs text-muted-foreground">(opcional)</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {ALL_INSTRUMENTS.map((ins) => (
            <button
              key={ins.value}
              type="button"
              onClick={() => toggleInstrument(ins.value)}
              className={cn(
                pillBase,
                draft.instruments.includes(ins.value) ? pillOn : pillOff,
              )}
            >
              {ins.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          NPS, CES, CSAT, ISN. El Agente 2 los ancla a métricas HEART.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Tipos de fuente esperados</Label>
          <Badge variant="outline" className="text-xs">
            auto-derivados · editables
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => toggleKind(k.value)}
              className={cn(
                pillBase,
                draft.expectedSourceKinds.includes(k.value) ? pillOn : pillOff,
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Derivados de los métodos. El hub de Fuentes los usa para el indicador
          de completitud.
        </p>
      </div>
    </div>
  );
}
