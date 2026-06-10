# ESTADO DEL PROYECTO — Product Designer Agéntico

> Documento de handoff para seguir iterando (con Claude o no). Resume qué es el proyecto,
> qué está hecho, el estado actual, cómo correrlo y qué sigue.
> Fuente de verdad de alcance: [PRD-product-designer-agentico.md](PRD-product-designer-agentico.md). Anclas de sesión: [CLAUDE.md](CLAUDE.md).

---

## 1. Qué es
Un **orquestador de agentes** para el proceso E2E de diseño de producto (7 etapas: Descubrimiento →
Definición → Exploración → Diseño → Validación → Entrega → Aprendizaje), bajo **Spec-Driven
Development**. La **spec** (contrato versionado de qué y por qué) es la fuente de verdad; el agente
**propone** cambios y un humano los **aprueba** en compuertas explícitas. Se expone como un dashboard
**centrado en la spec** (no un lanzador de agentes).

## 2. Invariantes (no negociables)
1. La spec es la fuente de verdad; el dashboard gira en torno a ella.
2. Las compuertas humanas (enmarcar/curar/responder) **nunca** se automatizan.
3. Anti-alucinación: **extraer la evidencia ANTES** de derivar el hallazgo.
4. Lo cuantitativo se **computa** con scripts deterministas; el modelo no estima números.
5. Sin fuente anclada no hay output (archivo + locator + cita o cálculo).
6. El esquema de la spec es desechable; se revisa a medida que los agentes producen.
7. Todo queda en el **log de auditoría** (quién/qué/cuándo y por qué se rechazó un hallazgo).

## 3. Stack y layout
- **Monorepo TypeScript** (pnpm workspaces, Node 20+). Build/typecheck/test/format en la raíz.
- **Modelo:** `claude-opus-4-8` vía `@anthropic-ai/sdk` con structured outputs (`output_config.format`
  json_schema) + adaptive thinking. `ANTHROPIC_API_KEY` en `.env` (gitignored). `PDA_MODEL` configurable.
- **Spec:** YAML versionado en git (`specs/<id>/`), validado con `zod` al leer/escribir.

```
packages/spec          esquema (zod) + store (YAML/git/auditoría)
packages/agent1        Agente 1 — Descubrimiento: ingestión, extracción, cómputo, derivación
packages/agent2        Agente 2 — Definición: problem statement, JTBD, métricas HEART
packages/orchestrator  estado + routing 2 etapas + verificación + gate + auditoría (CLI)
apps/dashboard         Vite+React (router por etapas) + server Express delgado
specs/                 almacén de spec en git    samples/   set sintético del Agente 1
scripts/gen-samples.mjs  generador determinista del set de muestra
```

## 4. Qué está hecho

### Fase 0 — Fundaciones ✅
Esquema de spec (zod, §7) con `finding` como objeto de primera clase; store git + auditoría; shell del
dashboard. Commits `521c2fd`·`a06f4a7`·`74d7bb8`·`cea37c5`.

### Fase 1 — Vertical slice: Agente 1 + orquestador + gate enmarcar ✅
El **motor anti-alucinación completo y real** sobre archivos locales (txt/pdf/xlsx/csv):
recolectar → extraer evidencia (cita verificada como substring real) → computar (determinista) →
derivar hallazgos (solo desde la evidencia) → sintetizar → gate. Cableado al dashboard.
Commits `a726e32`→`3830714` (1.1–1.8).

### Fase 2 — Definición completa: diamante Problema 100% real ✅
- Esquema: `+ jtbd` (jobs anclados a findings), `outcomes` enriquecidos (`heart` HEART + `signals`).
- **Agente 2 (Definición)**: problem statement + **JTBD** + **métricas HEART/GSM**, derivados SOLO de los
  hallazgos validados (cada job cita sus `F-xxx`; baselines del cómputo; targets al humano).
- **Orquestador de dos etapas**: Descubrimiento (Agente 1 → hallazgos) → triage humano →
  Definición (Agente 2 → propuesta) → **gate enmarcar refinado** (6 criterios bloqueantes).
Commits `1142261`→`816b0cd` (2.1–2.5).

### Dashboard — refactor a navegación por etapas ✅
Sidebar persistente (7 etapas + Spec viva + Auditoría, con meta de spec siempre visible) + routing
(`react-router-dom`) + tabs de sección por etapa. Overview "Spec viva" holístico; Descubrimiento
(hallazgos/evidencia/verificación) y Definición (enmarcado/JTBD/métricas/compuerta) reales; etapas
3–7 mockeadas con su plan (artefactos/gate del PRD). Commits `b930a61`→`293643d` (D.1–D.6).

### Fase D2 — experiencia del dashboard (EN CURSO) · Sesión 1 (W0.1+W0.2) ✅
Gestión multi-spec: el dashboard deja de estar pegado a `otp-onboarding`.
- **Esquema:** `SpecSchema += product` (string agrupador), `description?`, `archived` (soft-delete),
  todos con default para compat con specs previas. `createSpecV0` los acepta.
- **Índice (`packages/spec/src/specs.ts`):** `specs/index.yaml` es **cache regenerable** (la verdad
  es `specs/<id>/`); `buildIndex` escanea el filesystem y omite dirs inválidos, `readIndex` regenera
  si falta/corrupto. Entrada: `{id, name, product, stage, status(activa|archivada), updatedAt}`
  (`status` deriva de `archived`; `updatedAt` del último timestamp de auditoría).
- **CRUD con auditoría:** `createSpec` (id inmutable kebab-case y único; slug del name si se omite),
  `updateSpecMeta` (id intacto), `archiveSpec` (soft delete, exige motivo, nunca borra el directorio).
  Verbos `spec.create|update|archive`.
- **API** (server del dashboard): `GET /api/specs` (agrupado por producto), `POST /api/specs`,
  `PATCH /api/specs/:id`, `POST /api/specs/:id/archive`, `POST /api/specs/reindex`. Shim temporal en
  `App.tsx` (aplana grupos a ids activas hasta que Sesión 2 rediseñe el home).
- **CLI espejo** (orquestador): `list-specs`, `create-spec`, `update-spec`, `archive-spec`.
- **Migración:** `otp-onboarding` gana `product: Onboarding` en `spec.yaml` y `spec.proposed.yaml`
  (el Agente 2 preserva `product` vía `...current`, así sobrevive a la aprobación de la compuerta).

**Tests:** ~70 (spec 36 · agent1 21 · agent2 3 · orchestrator 10). Lógica anti-alucinación testeada
offline (stubs) + verificada con corridas reales contra la API. El CRUD multi-spec se verificó
además live por curl y por CLI (crear/listar/editar/archivar + regeneración del índice).

## 5. Estado actual del repo
- Spec `otp-onboarding`: **v3 approved**, producto **Onboarding**, etapa `definicion`, con una
  **propuesta de Definición pendiente** (8 hallazgos en la spec, 5 JTBD, propuesta `in_review`).
  **Ready-to-demo**.
- Multi-spec operativo por API/CLI (sin UI de "Mis specs" todavía → Sesión 2). El índice
  `specs/index.yaml` es cache regenerable y está **gitignored**.
- Working tree limpio. Demo levantable en `http://localhost:5173`.

## 6. Cómo correr / demostrar / iterar
```bash
pnpm install && pnpm build          # compila todos los paquetes
pnpm typecheck && pnpm -r test      # gates de calidad
pnpm dev                            # dashboard http://localhost:5173 (+ API :8791)

# CLI del orquestador (desde la raíz; las que llaman al modelo necesitan --env-file=.env):
node --env-file=.env packages/orchestrator/dist/cli.js discover otp-onboarding
node           packages/orchestrator/dist/cli.js reject  otp-onboarding F-009 --reason "..."
node --env-file=.env packages/orchestrator/dist/cli.js define   otp-onboarding
node           packages/orchestrator/dist/cli.js approve otp-onboarding --by "Lead PM"
node           packages/orchestrator/dist/cli.js status  otp-onboarding

# Demos por agente (corrida real, muestran el output):
node --env-file=.env packages/agent1/dist/demo-derive.js     # documentos → hallazgos anclados
node --env-file=.env packages/agent2/dist/demo-define.js     # hallazgos → JTBD + métricas
```
Regenerar el set de muestra: `node scripts/gen-samples.mjs`. Reemplazar `samples/` por datos reales
cuando los haya (el motor corre igual).

## 7. Decisiones clave / gotchas (para no repetir tropiezos)
- **Tests:** `node --test "dist/**/*.test.js"` (glob a dist; bare `node --test` levanta los `.ts` de src en Node 25).
- **PDF:** `pdfjs-dist` (no `pdf-parse`, que rompe con PDFs de pdfkit).
- **Structured outputs:** enum nullable NO se expresa como `type:["string","null"]+enum`; usar enum string requerido.
- **Dashboard:** BrowserRouter (Vite sirve el fallback SPA; el Express solo responde `/api`). Puerto API `DASH_PORT` (default 8791; el 8787 lo usa otro proyecto local).
- **Store:** `writeSpec/writeProposedSpec/writeFindings` validan contra el esquema **antes** de escribir; `approveGate` limpia `findings.yaml` y `spec.proposed.yaml` al aprobar (los findings quedan en la spec).
- **Procedencia:** la verificación re-ancla por código (la evidencia/los ids de findings se re-adjuntan; no se confía en lo que reproduzca el modelo).
- **Índice de specs (D2):** `specs/index.yaml` es CACHE; la verdad es `specs/<id>/spec.yaml`. Toda
  mutación regenera el índice escaneando el filesystem (no se parchea a mano); está gitignored.
  `archived` vive en la spec (no solo en el índice) para que `status` activa/archivada sea
  reconstruible. `buildIndex` omite dirs sin spec válida — no tumba el listado por una spec rota.
- **Metadatos y aprobación (D2):** `product`/`description`/`archived` los preserva el Agente 2 vía
  `...current` en `define.ts`, y `approveGate` los hereda con `...proposed`. Si en el futuro un
  runner construye la propuesta desde cero (sin spread de `current`), hay que re-inyectar estos
  campos o se perderá el agrupador al aprobar.
- **id de spec inmutable (D2):** el `id` es ruta en git + clave de auditoría; `PATCH`/`update-spec`
  NO lo tocan. Validación kebab-case `^[a-z0-9]+(-[a-z0-9]+)*$`; si se omite, se deriva del name
  por slug (acentos removidos vía NFD).

## 8. Qué falta — próximos pasos

### Inmediato: Fase D2 (experiencia del dashboard) — bloquea la Fase 3
Se ejecuta COMPLETA antes de arrancar agentes nuevos. Plan: [PLAN-FASE-D2-experiencia-dashboard.md](PLAN-FASE-D2-experiencia-dashboard.md).
- **Sesión 1 (W0.1+W0.2) — HECHA:** índice + CRUD multi-spec (API/CLI).
- **PRÓXIMA = Sesión 2 (W0.3+W0.4):** routing `/spec/:id/...` con aislamiento de contexto por spec
  (cero estado compartido salvo el índice; el shim de `App.tsx` se reemplaza) + pantalla **"Mis specs"**
  como home (tarjetas agrupadas por producto, modal "Nueva spec") + **switcher de spec** en el sidebar.
  Hecho cuando: dos specs en pestañas distintas no se pisan; crear spec + correr Descubrimiento desde la UI.
- **Luego:** W1 (hub de Fuentes), W2 (revisión humana granular por hallazgo), W3 (rediseño visual
  modular), W4 (drawer + modales), W5 (capa de usuario mock) + ensayo del guión de demo (<12 min).

### Después de D2: Fase 3 — diamante Solución (del PRD §15)
- **Fase 3 — diamante Solución:** Agentes Exploración, Diseño, Validación + **gate curar**; integración
  real del **design system** (los 3 roles §D10: restricción/fuente/validador) y chequeos automatizables
  (contraste, tokens). Las páginas mockeadas 3–5 del dashboard ya anticipan estas etapas.
- **Fase 4 — diamante Entrega:** Agentes Entrega y Aprendizaje + **gate responder con control de acceso**
  (decisión regulatoria, accountability).
- **Fase 5 — gobernanza/hardening:** config real de conectores (MCP, OAuth por usuario), **RBAC**, log de
  auditoría completo, endurecimiento de seguridad, pulido de producción.
- **Transversal:** revisar el esquema de la spec con lo aprendido; medir baselines de tiempo (eficiencia);
  calibrar el umbral de aprobación en lote de hallazgos.

## 9. Mapa rápido (dónde tocar qué)
- Esquema de la spec → `packages/spec/src/schema.ts`. Store/auditoría → `store.ts`/`audit.ts`.
- Loop del Agente 1 → `packages/agent1/src/{ingest,compute,extract,derive}.ts`.
- Agente 2 (Definición) → `packages/agent2/src/define.ts`.
- Routing/estado/gate/verificación → `packages/orchestrator/src/{stage,verify,runner,cli}.ts`.
- Endpoints del dashboard → `apps/dashboard/server/index.ts`. UI → `apps/dashboard/src/{App,api,stages}.ts`,
  `src/pages/*`, `src/components/*`.
- Para un **agente nuevo** (Fase 3+): copiar el patrón de `agent2` (proposer inyectable + structured
  outputs + ensamblado determinista que valida y re-ancla), agregar el runner y el routing en el
  orquestador, y la página de etapa en el dashboard (ya existe el placeholder con su plan).
