# Product Designer Agéntico — guía del repo

> Fuente de verdad del proyecto: [PRD-product-designer-agentico.md](PRD-product-designer-agentico.md). Léelo ante cualquier duda de alcance.
> La SPEC es la fuente de verdad del producto; este repo gira alrededor de ella.

## Invariantes (override de cualquier default)

1. La spec es la fuente de verdad. El dashboard es CENTRADO EN LA SPEC, no un lanzador de agentes.
2. Las compuertas humanas (enmarcar/curar/responder) NUNCA se automatizan. El agente propone; el humano aprueba.
3. Anti-alucinación: extraer la evidencia ANTES de derivar el hallazgo, nunca al revés.
4. Lo cuantitativo se COMPUTA con scripts deterministas sobre las filas. El modelo NO estima números.
5. Ningún hallazgo ni output existe sin fuente anclada: archivo + locator + cita (texto) o cálculo (tabular).
6. El esquema de la spec es v0 desechable; se revisa tras el Agente 1.
7. Todo queda en el log de auditoría (quién/qué/cuándo, y por qué se rechazó un hallazgo).

## Alcance actual: F0+F1+F2 (hechas) · Fase D2 (en curso) · Fase 3 (bloqueada por D2)

- HECHO (F0+F1): esquema/almacén de spec en git, dashboard centrado en la spec, orquestador
  mínimo, Agente 1 (Descubrimiento) sobre archivos locales (txt/pdf/xlsx/csv), compuerta enmarcar.
- HECHO (F2): Agente 2 (Definición completo) — problem statement, JTBD y métricas HEART/GSM
  anclados a los hallazgos; routing de dos etapas (Descubrimiento → Definición → gate enmarcar);
  cierre del diamante Problema.
- EN CURSO (D2 — experiencia del dashboard, ver [PLAN-FASE-D2-experiencia-dashboard.md](PLAN-FASE-D2-experiencia-dashboard.md)):
  se ejecuta COMPLETA antes de la Fase 3. Sesión 1 hecha (W0.1+W0.2): gestión multi-spec —
  metadatos `product`/`description`/`archived`, índice `specs/index.yaml` (cache regenerable),
  CRUD de specs (API + CLI) con auditoría `spec.create|update|archive`. Faltan W0.3–W5
  (routing /spec/:id, fuentes, revisión granular, rediseño visual, capa de usuario).
- BLOQUEADO (F3): los 5 agentes restantes (Exploración→Aprendizaje) NO se arrancan hasta cerrar D2
  (W0–W5 + guión de demo). También fuera: config real de MCP/conectores, RBAC, multi-agente paralelo.

## Metodología de trabajo

Spec-Driven: planificar → confirmar → construir. Por fases, en pasos chicos y verificables.
No avanzar a la etapa N+1 sin que la compuerta de la etapa N funcione. Etiquetar siempre real vs mockeado.

## Stack

TS monorepo (pnpm). Spec en YAML+git (zod). Agente 1 = @anthropic-ai/sdk (claude-opus-4-8, ANTHROPIC_API_KEY).
Cómputo tabular determinista en TS. Dashboard Vite+React + server delgado que lee el almacén de spec.

## Layout

- `packages/spec` — esquema (zod) + spec store (read/write YAML, git, audit).
- `packages/agent1` — Descubrimiento: ingestión, extracción de evidencia, cómputo, derivación, síntesis.
- `packages/orchestrator` — estado + routing de 1 etapa + verificación + gate + auditoría (CLI).
- `apps/dashboard` — Vite+React (visor spec, triage findings, gate) + server delgado. (Se construye en el paso 0.4.)
- `specs/` — almacén de spec versionado en git. `samples/` — set de muestra del Agente 1.

## Comandos

- `pnpm install` — instala dependencias del workspace.
- `pnpm build` — compila todos los paquetes (`pnpm -r build`).
- `pnpm typecheck` — type-check sin emitir.
- `pnpm test` — corre los tests de cada paquete.
