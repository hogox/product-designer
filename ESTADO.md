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

### Fase D2 · Sesión 2 (W0.3+W0.4) ✅ — routing spec-scoped + home "Mis specs"
El dashboard deja de estar pegado a una spec en estado de React: el contexto vive en la URL.
- **Routing:** toda spec cuelga de `/spec/:specId` (Overview, etapas, auditoría). `App` lee el
  `specId` de `useParams`; helper `nav.ts:specPath` centraliza el prefijo en sidebar/overview/tabs/
  redirects. **Aislamiento por URL:** refresh conserva dónde estabas y dos pestañas con specs
  distintas no se pisan. `/` = home "Mis specs"; `*` → `/`.
- **Home `SpecsHomePage`:** tarjetas agrupadas por producto (estado, etapa, badge **propuesta
  pendiente**), toggle "ver archivadas", CTA **"+ Nueva spec"** → `NewSpecModal` (producto vía
  datalist de existentes o nuevo; cierre con Esc) → `POST /api/specs` → navega a `/spec/:id`.
- **Switcher** en el sidebar: specs activas del **mismo producto** + "Ver todas las specs" (→ `/`).
- **Índice:** la entrada gana `hasProposal` (¿existe `spec.proposed.yaml`?) para el badge del home
  en un solo fetch.

### Fase D2 · Sesión 3 (W1.1+W1.2) ✅ — hub de Fuentes (modelo + API)
Documentación subida por el usuario, versionada junto a la spec, que alimentará al Agente 1.
- **Modelo (`packages/spec/src/sources.ts`):** `specs/<id>/sources/manifest.yaml` (zod) + binarios en
  `sources/files/<sourceId>/<filename-original>`. El subdir por id evita colisiones y **preserva
  nombre+extensión** (clave: `ingestFile` despacha por extensión y la evidencia cita el archivo real).
  `SourceEntry { id(S-NNN), filename, mime, kind(documento|datos|entrevista|otro), size, sha256,
  uploadedBy, uploadedAt, status(subido|ingerido|descartado), linkedStages[] }`. **size y sha256 se
  computan del binario** en el server (no se confían del cliente).
- **Store:** `readSources`, `writeManifest` (valida), `addSource` (`source.upload`), `updateSource`
  (`source.update`), `discardSource` (soft delete — status `descartado`, **conserva el binario**,
  `source.discard`). `inferKind` por mime/extensión.
- **API (server):** `GET/POST(multipart, multer)/PATCH/DELETE(lógico) /api/specs/:id/sources`, con
  400 en kind/status inválidos y 404 si no existe. Cada mutación audita actor/target/timestamp.

**Tests:** ~81 (spec 47 · agent1 21 · agent2 3 · orchestrator 10). Lógica anti-alucinación testeada
offline (stubs) + verificada con corridas reales contra la API. El CRUD multi-spec y el hub de
Fuentes se verificaron además live por curl/CLI; el routing y el home, en el preview.

## 5. Estado actual del repo
- Spec `otp-onboarding`: **v3 approved**, producto **Onboarding**, etapa `definicion`, con una
  **propuesta de Definición pendiente** (8 hallazgos en la spec, 5 JTBD, propuesta `in_review`).
  **Ready-to-demo** en `http://localhost:5173/spec/otp-onboarding`.
- Multi-spec operativo por API/CLI **y por UI**: home "Mis specs" en `/`, crear/cambiar de spec sin
  terminal, contexto aislado por URL (`/spec/:id/...`). El índice `specs/index.yaml` es cache
  regenerable y está **gitignored**.
- Hub de Fuentes operativo por API (multipart): subir/listar/editar/descartar; falta la **ingestión
  real** (W1.3: que `discover` lea `sources/files/` en vez de `samples/`) y la **UI** (W1.4).
- Working tree limpio. Home del dashboard: `http://localhost:5173`.

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
- **Routing spec-scoped (D2·W0.3):** el `specId` vive SOLO en la URL (`/spec/:id/...`), no en estado.
  Al agregar vistas nuevas (fuentes, etc.) construir los links con `nav.ts:specPath`, nunca rutas
  absolutas sueltas. El home `/` no monta el `App` shell (no hay spec activa → sin sidebar de etapas).
- **API dist en el server:** el server del dashboard importa `@pda/spec` desde `dist`. Tras tocar
  `packages/spec`, correr `pnpm --filter @pda/spec build` y **reiniciar** el server del preview
  (el `node --watch` no siempre recarga al cambiar el symlink de workspace) para ver el cambio en `/api`.
- **preview_click + navegación:** un `preview_click` disparado justo tras `location.href=...` puede
  perderse (la página aún recarga). Si el modal/elemento "no abre", reintentar tras estabilizar, o
  clickear vía `preview_eval` (`el.click()`).
- **Fuentes (D2·W1):** los binarios se guardan en `sources/files/<sourceId>/<filename-original>` —
  NO renombrar ni aplanar: `ingestFile` despacha por extensión y la evidencia usa `basename`. size y
  sha256 los computa el store desde los bytes (no confiar en el cliente). El mime del cliente puede
  venir `application/octet-stream` (p. ej. curl con .csv); por eso `inferKind` mira también la
  extensión. Subida = `multer` memoryStorage (límite 25 MB) en el server del dashboard. Descartar es
  soft delete (status `descartado`); el binario queda. Estos binarios SÍ se versionan (no gitignored).

## 8. Qué falta — próximos pasos

### Inmediato: Fase D2 (experiencia del dashboard) — bloquea la Fase 3
Se ejecuta COMPLETA antes de arrancar agentes nuevos. Plan: [PLAN-FASE-D2-experiencia-dashboard.md](PLAN-FASE-D2-experiencia-dashboard.md).
- **Sesión 1 (W0.1+W0.2) — HECHA:** índice + CRUD multi-spec (API/CLI).
- **Sesión 2 (W0.3+W0.4) — HECHA:** routing `/spec/:id` con aislamiento de contexto + home
  "Mis specs" + modal "Nueva spec" + switcher.
- **Sesión 3 (W1.1+W1.2) — HECHA:** modelo + API del hub de Fuentes (multipart, auditado).
- **PRÓXIMA = Sesión 4 (W1.3 ingestión + W1.4 UI de fuentes):**
  - **W1.3:** el runner de Descubrimiento usa `sources/files/` cuando el manifest tiene fuentes
    `subido|ingerido`; si no, cae a `samples/` (transición suave). Al correr, marca `ingerido`.
    Hecho cuando: `discover` corre E2E con un PDF y un CSV subidos por la UI y la evidencia cita esos
    archivos. (Tocar `packages/orchestrator/src/runner.ts` y el cableado del CLI/`discover`.)
  - **W1.4:** página "Fuentes" en el sidebar (lista con badge de tipo/tamaño/estado/etapas) + modal
    selector reutilizable ("Seleccionar fuentes") con buscador y chips por tipo + "Subir fuentes"
    (drag&drop). Hecho cuando: subir → ver en lista → seleccionar → correr Descubrimiento desde la UI.
- **Luego:** W2 (revisión granular por hallazgo), W3 (rediseño visual modular), W4 (drawer +
  modales), W5 (capa de usuario mock) + ensayo del guión de demo (<12 min).

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
