// Home "Mis specs" (D2 · W0.4): specs agrupadas por producto, sin spec activa (sin
// sidebar de etapas). Punto de entrada del dashboard multi-spec. Migrado a shadcn/Tailwind
// (impulso visual): tarjetas Card interactivas con hover, chips como variantes de Badge.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSpecGroups, type SpecGroup, type SpecIndexEntry } from "../api";
import { NewSpecModal } from "../components/NewSpecModal";
import { AccountMenu } from "../components/AccountMenu";
import { specPath } from "../nav";

export function SpecsHomePage() {
  const [groups, setGroups] = useState<SpecGroup[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSpecGroups()
      .then(setGroups)
      .catch((e) => setError(String(e)));
  }, []);

  const products = groups.map((g) => g.product);

  const archivedCount = groups
    .flatMap((g) => g.specs)
    .filter((s) => s.status === "archivada").length;

  const visibleGroups = groups
    .map((g) => ({
      product: g.product,
      specs: g.specs.filter((s) => showArchived || s.status === "activa"),
    }))
    .filter((g) => g.specs.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-4 flex justify-end">
        <div className="w-56">
          <AccountMenu />
        </div>
      </div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mis specs</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Cada spec es un contrato versionado, con sus propias fuentes,
            hallazgos y auditoría.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="size-4" />
          Nueva spec
        </Button>
      </header>

      {showModal && (
        <NewSpecModal products={products} onClose={() => setShowModal(false)} />
      )}

      {error && (
        <Card className="border-destructive/40 p-4 text-sm text-destructive">
          Error: {error}
        </Card>
      )}

      {!error && groups.length === 0 && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground italic">
            Todavía no hay specs.
          </p>
        </Card>
      )}

      <div className="space-y-6">
        {visibleGroups.map((g) => (
          <section key={g.product}>
            <h2 className="mb-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {g.product}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.specs.map((s) => (
                <SpecCard key={s.id} entry={s} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {archivedCount > 0 && (
        <button
          type="button"
          className="mt-6 text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived
            ? "Ocultar archivadas"
            : `Ver archivadas (${archivedCount})`}
        </button>
      )}
    </div>
  );
}

function SpecCard({ entry }: { entry: SpecIndexEntry }) {
  const archived = entry.status === "archivada";
  return (
    <Link to={specPath(entry.id)} className="group">
      <Card
        className={`gap-0 p-4 transition-colors group-hover:border-primary/30 group-hover:bg-muted/50 ${
          archived ? "opacity-60" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium">{entry.name}</span>
          <Badge variant={archived ? "mock" : "real"}>{entry.status}</Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          etapa: {entry.stage}
        </div>
        {entry.hasProposal && (
          <div className="mt-3">
            <Badge variant="enPausa">propuesta pendiente</Badge>
          </div>
        )}
        <div className="mt-3">
          <Badge variant="outline" className="font-mono">
            {entry.id}
          </Badge>
        </div>
      </Card>
    </Link>
  );
}
