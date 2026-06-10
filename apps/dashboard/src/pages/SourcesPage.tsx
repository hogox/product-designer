// Página "Fuentes" (D2 · W1.4): subir documentación (drag&drop / picker), verla listada con
// badge de tipo, tamaño, estado y etapas asociadas, reclasificar el tipo y descartar (lógico).
// Las fuentes alimentan al Agente 1 (W1.3): el subir reemplaza a samples/ cuando existen.

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import {
  getSources,
  uploadSource,
  patchSource,
  discardSource,
  type SourceEntry,
  type SourceKind,
} from "../api";

const KINDS: SourceKind[] = ["documento", "datos", "entrevista", "otro"];

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
    <div>
      <div className="stage-head">
        <h1>Fuentes</h1>
        <div className="meta">
          La documentación que subís alimenta al Agente 1 (Descubrimiento). Sin
          fuentes, el agente usa el set de muestra.
        </div>
      </div>

      <div
        className={`dropzone${dragOver ? " over" : ""}`}
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
        {busy ? "Subiendo…" : "Arrastrá archivos acá o hacé clic para subir"}
        <div className="meta">PDF · XLSX · CSV · TXT · DOCX</div>
      </div>

      {error && <div className="panel error">Error: {error}</div>}

      {active.length === 0 && (
        <div className="panel">
          <p className="empty">Todavía no hay fuentes subidas.</p>
        </div>
      )}

      {active.map((s) => (
        <SourceRow
          key={s.id}
          source={s}
          onReclassify={onReclassify}
          onDiscard={onDiscard}
        />
      ))}

      {discarded.length > 0 && (
        <>
          <div className="nav-group" style={{ padding: "16px 0 4px" }}>
            Descartadas ({discarded.length})
          </div>
          {discarded.map((s) => (
            <SourceRow key={s.id} source={s} discarded />
          ))}
        </>
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
    <div className={`source-row${discarded ? " discarded" : ""}`}>
      <div className="source-main">
        <span className="source-name">{s.filename}</span>
        <div className="source-tags">
          <span className="badge kind">{s.kind}</span>
          <span className="pill">{humanSize(s.size)}</span>
          <span className={`badge status-${s.status}`}>{s.status}</span>
          {s.linkedStages.map((st) => (
            <span key={st} className="pill">
              {st}
            </span>
          ))}
        </div>
      </div>
      {!discarded && (
        <div className="source-actions">
          <select
            value={s.kind}
            onChange={(e) => onReclassify?.(s.id, e.target.value as SourceKind)}
            aria-label="Reclasificar tipo"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="link-button"
            onClick={() => onDiscard?.(s.id)}
          >
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}
