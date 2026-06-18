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

## Alcance actual: F0+F1+F2 · D2 · F3-A Exploración (CERRADA) · corridas desde la UI (HECHO) · O2 (HECHO) · claridad Input↔Spec en UI (HECHO) · F3-B (siguiente)

- HECHO (F0+F1): esquema/almacén de spec en git, dashboard centrado en la spec, orquestador
  mínimo, Agente 1 (Descubrimiento) sobre archivos locales (txt/pdf/xlsx/csv), compuerta enmarcar.
- HECHO (F2): Agente 2 (Definición completo) — problem statement, JTBD y métricas HEART/GSM
  anclados a los hallazgos; routing de dos etapas (Descubrimiento → Definición → gate enmarcar);
  cierre del diamante Problema.
- HECHO (D2 — experiencia del dashboard, ver [PLAN-FASE-D2-experiencia-dashboard.md](PLAN-FASE-D2-experiencia-dashboard.md)):
  12 sesiones completadas (W0–W6); D2 CERRADA. Resumen de sesiones:
  - Sesión 1 (W0.1+W0.2): gestión multi-spec — metadatos, índice `specs/index.yaml`, CRUD + auditoría.
  - Sesión 2 (W0.3+W0.4): routing spec-scoped `/spec/:id`, home "Mis specs", switcher de spec.
  - Sesión 3 (W1.1+W1.2): hub de Fuentes — modelo `sources/manifest.yaml` + API multipart auditada.
  - Sesión 4 (W1.3+W1.4): ingestión desde fuentes + UI página "Fuentes" (drag&drop/picker).
  - Sesión 5 (W2.1+W2.2): estados de revisión por hallazgo (pendiente/aprobado/rechazado/en_pausa),
    API/CLI no-destructiva.
  - Sesión 6 (W2.3+W2.4): gate respeta estados de revisión + UI de triage plena con modal de comentario.
  - Sesión 7 (W3.1+W3.2): bootstrap shadcn/ui + Tailwind v4 + tokens claros (oscuro eliminado),
    layout modular con breadcrumb/Cards/pipeline clickeable.
  - Sesión 8 (W3.3+W3.4+W4.1 + impulso visual): 11 variantes cva Badge (AA), mapa de iconos,
    stat-cards, drawer de hallazgo (Sheet) con cadena evidencia→fuente + historial + trazabilidad JTBD.
  - Sesión 11 (W6.1+W6.2 — intake, ADELANTADA): esquema `intake` opcional (researchQuestion +
    hypotheses + productContext + discoveryPlan), kind `persona`, grounding del Agente 1 SOLO en
    derivación (invariante 3), completitud de fuentes + `PATCH …/intake` auditado.
  - Sesión 9 (W4.2+W4.3): modales Dialog stock + confirmación de compuerta + a11y (foco/Esc/teclado);
    `styles.css` ELIMINADO entero (cero CSS legado).
  - Sesión 10 (W5): capa de usuario mock — login/SessionProvider/AccountMenu/settings; identidad REAL
    firma la auditoría (`actorLabel`).
  - Sesión 12 (W6.3+W6.4): wizard de creación de spec (5 pasos: Identidad→Enmarcado→Plan→Fuentes→
    Crear); creación atómica con intake + fuentes al commit; `IntakeEditPage` (retrofit para specs
    previas en `/spec/:id/intake`); `NewSpecModal` eliminado (subsumed por wizard). Overview muestra
    la `researchQuestion` como encabezado de contexto (o CTA para definirla). **D2 COMPLETA.**
- HECHO (O1 — optimización de tokens, Sesión 13): 5 pasos sobre el motor. Ver ESTADO.md.
- HECHO (F3-A — Agente 3 Exploración, Sesiones 14–15c): `@pda/llm` (callStructured/resolveModel),
  migración de los 3 proposers, `@pda/agent3`, orquestador (`explore`/`select-concept`/
  `discard-concept`/`close-exploration`/`discard-proposal`), dashboard `exploracion` real
  (ConceptsTriage + panel de cierre). **Etapa con cierre formal** (Sesión 15c, ver ESTADO.md §15c):
  el triage humano selecciona conceptos → `close-exploration` los promueve a `spec.concepts` +
  Decision y avanza la etapa a `diseno`. Topic/grounding derivados de la spec; re-explore no
  destructivo; estado coherente (sin propuesta colgada + explore). 143 tests.
  `otp-onboarding` quedó en etapa `diseno` con 3 conceptos promovidos — **entrada lista para el A4**.
- HECHO (Sesión 16 — correr agentes desde la UI): los 3 agentes (discover/define/explore) se disparan
  desde el dashboard, sin terminal. Server con la key vía `--env-file` (nunca en el browser), jobs
  async con **lock por (spec, agente)** (409), **preflight cache-aware** (muestra el costo y "nada
  cambió" antes de gastar), **guarda de re-corrida** (Dialog de confirmación) y **contabilidad de
  tokens real** (threadeada hasta la UI + auditoría). `RunAgentButton` es el patrón reusable. El
  stakeholder opera 100% en la UI (revisar/aprobar); el operador ya no necesita CLI. 150 tests.
  Detalle: ESTADO.md §Sesión 16.
- HECHO (Sesión 17 — sugerir intake con IA + O2 optimización): wizard y `IntakeEditPage` tienen
  botón "Sugerir con IA" (haiku, stateless, `POST /api/intake/suggest`). O2 completa: hallazgos
  cuantitativos por script (`buildQuantitativeFindings`, invariante 4), cache de resultados para
  derive/define/explore (`cachedModelCall`, `result-cache/`), filtro de ruido en segmentos
  (`filterSegments`, < 30 chars + dedup), truncar anclas en `formatFindings` (120 chars, max 2),
  `resolveModel` con `defaultModel` param (Haiku para intake). 168 tests. Detalle: ESTADO.md §Sesión 17.
- HECHO (Sesión 18 — visualizaciones del overview): módulo `viz/` (CategoryBar HEART, MetricBar
  baseline→target, ScopeViz in/non-goals; helpers parseMetric/colors), determinista (lee valores
  literales de la spec, sin modelo). Commit `67d8d54`.
- HECHO (Sesión 19 — claridad Input↔Spec en la UI): el dashboard distingue de forma explícita el
  **Input** (lo que el humano da: pregunta + hipótesis + plan, antes "Enmarcado") de la **spec** (lo
  que el sistema construye). "Enmarcado/enmarcar" queda solo para el output de Definición + su
  compuerta. Sidebar reagrupado (Entrada/Spec/Trazabilidad), `FlowBand` ("Vos das → proceso → el
  sistema construye"), panel de Input rotulado + divisor en el Overview, y estado vacío para specs v0.
  Cambio presentacional (sin tests nuevos; typecheck limpio + verificación en vivo). Detalle: ESTADO.md §Sesión 19.
- SIGUIENTE (F3-B/C/D/E): **Agente 4 Diseño** (lee `spec.concepts`, produce artefactos de diseño
  anclados a los conceptos; nace con su botón "Correr Diseño" en la UI) → Validación (A5) → gate curar
  → Entrega (A6) → Aprendizaje (A7). También: config real MCP/conectores, RBAC, multi-agente paralelo.

## Metodología de trabajo

Spec-Driven: planificar → confirmar → construir. Por fases, en pasos chicos y verificables.
No avanzar a la etapa N+1 sin que la compuerta de la etapa N funcione. Etiquetar siempre real vs mockeado.

## Stack

TS monorepo (pnpm). Spec en YAML+git (zod). Agentes = `@pda/llm` + `@anthropic-ai/sdk`
(claude-opus-4-8, ANTHROPIC_API_KEY). Cómputo tabular determinista en TS.
Dashboard Vite+React + server delgado que lee el almacén de spec.

## Layout

- `packages/spec` — esquema (zod) + spec store (read/write YAML, git, audit).
- `packages/llm` — `callStructured`/`resolveModel`: shared helper para llamadas a Claude.
- `packages/agent1` — Descubrimiento: ingestión, extracción de evidencia, cómputo, derivación.
- `packages/agent2` — Definición: problem statement, JTBD, métricas HEART.
- `packages/agent3` — Exploración: conceptos de solución anclados a los JTBD.
- `packages/orchestrator` — estado + routing + gate + auditoría (CLI).
- `apps/dashboard` — Vite+React (visor spec, triage findings/conceptos, gate) + server Express.
- `specs/` — almacén de spec versionado en git. `samples/` — set de muestra del Agente 1.

## Comandos

- `pnpm install` — instala dependencias del workspace.
- `pnpm build` — compila todos los paquetes (`pnpm -r build`).
- `pnpm typecheck` — type-check sin emitir.
- `pnpm test` — corre los tests de cada paquete.
