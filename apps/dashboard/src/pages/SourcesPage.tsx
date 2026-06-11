// Página "Fuentes" (D2 · W1.4): subir documentación (drag&drop / picker), verla listada con
// badge de tipo, tamaño, estado y etapas asociadas, reclasificar el tipo y descartar (lógico).
// Las fuentes alimentan al Agente 1 (W1.3): el subir reemplaza a samples/ cuando existen.
// Migrado a shadcn/Tailwind (impulso visual): dropzone + filas Card, chips como variantes.

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FolderUp, UploadCloud } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getSources,
  getSourceCompleteness,
  uploadSource,
  patchSource,
  discardSource,
  type SourceEntry,
  type SourceKind,
  type SourceCompleteness,
} from "../api";
import { SourceKindBadge } from "../components/badges";
import { SectionIcon, SOURCE_KIND_ICON } from "../components/icons";

const KINDS: SourceKind[] = [
  "documento",
  "datos",
  "entrevista",
  "persona",
  "otro",
];

const STATUS_VARIANT: Record<
  string,
  "aprobado" | "rechazado" | "pendiente"
> = {
  ingerido: "aprobado",
  descartado: "rechazado",
  subido: "pendiente",
};

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SourcesPage() {
  const { specId } = useParams();
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [completeness, setCompleteness] = useState<SourceCompleteness | null>(
    null,
  );
  const [discardSid, setDiscardSid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refetch = useCallback(async () => {
    if (!specId) return;
    try {
      const [srcs, comp] = await Promise.all([
        getSources(specId),
        getSourceCompleteness(specId).catch(() => null),
      ]);
      setSources(srcs);
      setCompleteness(comp);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [specId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!specId) return;
      setBusy(true);
      setError(null);
      try {
        for (const file of Array.from(files)) {
          const res = await uploadSource(specId, file);
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            setError(body.error ?? `Error subiendo ${file.name}`);
          }
        }
        await refetch();
      } finally {
        setBusy(false);
      }
    },
    [specId, refetch],
  );

  async function onReclassify(sid: string, kind: SourceKind) {
    if (!specId) return;
    await patchSource(specId, sid, { kind });
    await refetch();
  }

  async function confirmDiscard(sid: string, reason?: string) {
    if (!specId) return;
    await discardSource(specId, sid, { reason: reason?.trim() || undefined });
    setDiscardSid(null);
    await refetch();
  }

  const active = sources.filter((s) => s.status !== "descartado");
  const discarded = sources.filter((s) => s.status === "descartado");

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <SectionIcon icon={FolderUp} tone="primary" className="size-11 [&>svg]:size-5" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Fuentes</h1>
          <p className="text-sm text-muted-foreground">
            La documentación que subís alimenta al Agente 1 (Descubrimiento).
            Sin fuentes, el agente usa el set de muestra.
          </p>
        </div>
      </div>

      <CompletenessIndicator completeness={completeness} />

      <div
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40",
          dragOver && "border-primary bg-primary/5 text-foreground",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length)
            void uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <UploadCloud className="size-6" />
        {busy ? "Subiendo…" : "Arrastrá archivos acá o hacé clic para subir"}
        <div className="text-xs">PDF · XLSX · CSV · TXT · DOCX</div>
      </div>

      {error && (
        <Card className="border-destructive/40 p-4 text-sm text-destructive">
          Error: {error}
        </Card>
      )}

      {active.length === 0 && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground italic">
            Todavía no hay fuentes subidas.
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {active.map((s) => (
          <SourceRow
            key={s.id}
            source={s}
            onReclassify={onReclassify}
            onDiscard={setDiscardSid}
          />
        ))}
      </div>

      {discarded.length > 0 && (
        <div className="space-y-2">
          <div className="pt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Descartadas ({discarded.length})
          </div>
          {discarded.map((s) => (
            <SourceRow key={s.id} source={s} discarded />
          ))}
        </div>
      )}

      {discardSid && (
        <DiscardSourceDialog
          filename={sources.find((s) => s.id === discardSid)?.filename ?? ""}
          onConfirm={(reason) => confirmDiscard(discardSid, reason)}
          onClose={() => setDiscardSid(null)}
        />
      )}
    </div>
  );
}

// Descartar una fuente (soft delete): motivo opcional, queda en auditoría. W4.2: Dialog stock.
function DiscardSourceDialog({
  filename,
  onConfirm,
  onClose,
}: {
  filename: string;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descartar fuente</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{filename}</span> deja
            de alimentar al Agente 1. Es un soft delete: el binario se conserva y
            queda en el log.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(reason);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="discard-reason">Motivo (opcional)</Label>
            <Textarea
              id="discard-reason"
              autoFocus
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Duplicada / fuera de alcance…"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive">
              Descartar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Completitud del plan de discovery (W6.2b): tipos esperados (del intake) vs. subidos.
// Solo se muestra si hay un plan que exige tipos (sin intake → expected vacío → no aparece).
function CompletenessIndicator({
  completeness: c,
}: {
  completeness: SourceCompleteness | null;
}) {
  if (!c || c.expected.length === 0) return null;
  return (
    <Card className="gap-0 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Completitud del plan</span>
        {c.satisfied ? (
          <Badge variant="aprobado">plan cubierto</Badge>
        ) : (
          <Badge variant="enPausa">
            faltan {c.missing.length} tipo{c.missing.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {c.expected.map((kind) => {
          const present = c.present.includes(kind);
          const Icon = SOURCE_KIND_ICON[kind];
          return present ? (
            <Badge key={kind} variant="real" className="capitalize">
              <Icon className="size-3" />
              {kind}
            </Badge>
          ) : (
            <Badge key={kind} variant="enPausa" className="capitalize">
              <Icon className="size-3" />
              falta: {kind}
            </Badge>
          );
        })}
      </div>
    </Card>
  );
}

function SourceRow({
  source: s,
  onReclassify,
  onDiscard,
  discarded = false,
}: {
  source: SourceEntry;
  onReclassify?: (sid: string, kind: SourceKind) => void;
  onDiscard?: (sid: string) => void;
  discarded?: boolean;
}) {
  return (
    <Card
      className={cn(
        "flex flex-row items-center justify-between gap-3 p-3.5",
        discarded && "opacity-60",
      )}
    >
      <div className="min-w-0">
        <div className="truncate font-medium">{s.filename}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <SourceKindBadge kind={s.kind} />
          <Badge variant="secondary">{humanSize(s.size)}</Badge>
          <Badge variant={STATUS_VARIANT[s.status] ?? "pendiente"}>
            {s.status}
          </Badge>
          {s.linkedStages.map((st) => (
            <Badge key={st} variant="outline">
              {st}
            </Badge>
          ))}
        </div>
      </div>
      {!discarded && (
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={s.kind}
            onChange={(e) => onReclassify?.(s.id, e.target.value as SourceKind)}
            aria-label="Reclasificar tipo"
            className="rounded-lg border bg-background px-2 py-1.5 text-xs"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDiscard?.(s.id)}
          >
            Descartar
          </Button>
        </div>
      )}
    </Card>
  );
}
