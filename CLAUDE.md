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

## Alcance actual: SOLO Fase 0 + Fase 1

- SÍ: esquema/almacén de spec en git, shell del dashboard, orquestador mínimo, Agente 1
  (Descubrimiento) sobre archivos locales (txt/pdf/xlsx/csv), compuerta enmarcar.
- NO: los otros 6 agentes, config real de MCP/conectores, RBAC, pulido de UI, multi-agente paralelo.

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
