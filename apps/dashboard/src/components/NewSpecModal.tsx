// Modal "Nueva spec" (D2 · W0.4): crea una spec por la UI (POST /api/specs) y navega a
// ella. El id es inmutable y lo deriva el servidor del nombre (o se valida si se envía).
// El producto se elige de los existentes o se escribe uno nuevo (datalist).
// W4.2: Dialog stock (foco atrapado + Esc + restaurar foco gratis); cero CSS legado.

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva spec</DialogTitle>
          <DialogDescription>
            Un contrato versionado con sus propias fuentes, hallazgos y
            auditoría.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="spec-name">Nombre del problema</Label>
            <Input
              id="spec-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Reducir el abandono en el checkout"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spec-product">Producto</Label>
            <Input
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spec-desc">Descripción (opcional)</Label>
            <Textarea
              id="spec-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={saving || !name.trim() || !product.trim()}
            >
              {saving ? "Creando…" : "Crear spec"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
