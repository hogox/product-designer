// Home "Mis specs" (D2 · W0.4): specs agrupadas por producto, sin spec activa (sin
// sidebar de etapas). Punto de entrada del dashboard multi-spec. La creación (modal) y
// el badge de propuesta pendiente llegan en el paso 2.2.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getSpecGroups, type SpecGroup, type SpecIndexEntry } from "../api";
import { NewSpecModal } from "../components/NewSpecModal";
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
    <div className="specs-home">
      <header className="specs-home-head">
        <div>
          <h1>Mis specs</h1>
          <div className="meta">
            Cada spec es un contrato versionado, con sus propias fuentes,
            hallazgos y auditoría.
          </div>
        </div>
        <button
          type="button"
          className="primary"
          onClick={() => setShowModal(true)}
        >
          + Nueva spec
        </button>
      </header>

      {showModal && (
        <NewSpecModal products={products} onClose={() => setShowModal(false)} />
      )}

      {error && <div className="panel error">Error: {error}</div>}

      {!error && groups.length === 0 && (
        <div className="panel">
          <p className="empty">Todavía no hay specs.</p>
        </div>
      )}

      {visibleGroups.map((g) => (
        <section key={g.product} className="product-group">
          <h2 className="product-name">{g.product}</h2>
          <div className="spec-cards">
            {g.specs.map((s) => (
              <SpecCard key={s.id} entry={s} />
            ))}
          </div>
        </section>
      ))}

      {archivedCount > 0 && (
        <button
          type="button"
          className="link-button"
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
    <Link
      to={specPath(entry.id)}
      className={`spec-card${archived ? " archived" : ""}`}
    >
      <div className="spec-card-head">
        <span className="spec-card-name">{entry.name}</span>
        <span className={`badge ${archived ? "mock" : "real"}`}>
          {entry.status}
        </span>
      </div>
      <div className="meta">etapa: {entry.stage}</div>
      {entry.hasProposal && (
        <span className="proposal-tag">propuesta pendiente</span>
      )}
      <div className="spec-card-foot">
        <span className="pill">{entry.id}</span>
      </div>
    </Link>
  );
}
