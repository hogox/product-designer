// Helper de rutas spec-scoped (D2 · W0.3): toda la navegación de una spec cuelga de
// /spec/:specId. Centralizar el prefijo evita links sueltos al refactorizar el routing.

export function specPath(specId: string | null | undefined, sub = ""): string {
  return `/spec/${specId ?? ""}${sub}`;
}
