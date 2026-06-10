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
import { cn } from "@/lib/utils";
import {
  getSources,
  uploadSource,
  patchSource,
  discardSource,
  type SourceEntry,
  type SourceKind,
} from "../api";
import { SourceKindBadge } from "../components/badges";
import { SectionIcon } from "../components/icons";

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refetch = useCallback(async () => {
    if (!specId) return;
    try {
      setSources(await getSources(specId));
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

  async function onDiscard(sid: string) {
    if (!specId) return;
    const reason =
      window.prompt("Motivo del descarte (opcional):") ?? undefined;
    await discardSource(specId, sid, { reason });
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
            onDiscard={onDiscard}
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
    </div>
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
