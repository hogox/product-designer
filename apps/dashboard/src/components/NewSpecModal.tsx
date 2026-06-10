// Modal "Nueva spec" (D2 · W0.4): crea una spec por la UI (POST /api/specs) y navega a
// ella. El id es inmutable y lo deriva el servidor del nombre (o se valida si se envía).
// El producto se elige de los existentes o se escribe uno nuevo (datalist).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { postJson, type SpecIndexEntry } from "../api";
import { specPath } from "../nav";

export function NewSpecModal({
  products,
  onClose,
}: {
  products: string[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [product, setProduct] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // cerrar con Esc (accesibilidad mínima; el foco atrapado llega en W4.3)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const res = await postJson("/api/specs", {
        name: name.trim(),
        product: product.trim(),
        description: description.trim() || null,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Error ${res.status}`);
        setSaving(false);
        return;
      }
      const entry = (await res.json()) as SpecIndexEntry;
      navigate(specPath(entry.id));
    } catch (err) {
      setError(String(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2>Nueva spec</h2>

        <label htmlFor="spec-name">Nombre del problema</label>
        <input
          id="spec-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Reducir el abandono en el checkout"
        />

        <label htmlFor="spec-product">Producto</label>
        <input
          id="spec-product"
          list="product-options"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          placeholder="Onboarding, Pagos, …"
        />
        <datalist id="product-options">
          {products.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>

        <label htmlFor="spec-desc">Descripción (opcional)</label>
        <textarea
          id="spec-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="primary"
            disabled={saving || !name.trim() || !product.trim()}
          >
            {saving ? "Creando…" : "Crear spec"}
          </button>
        </div>
      </form>
    </div>
  );
}
