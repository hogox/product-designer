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

### Fase D2 · Sesión 4 (W1.3+W1.4) ✅ — ingestión desde fuentes + UI de Fuentes

- **W1.3 (ingestión):** `createDiscoveryRunner` recibe `files[]` y rutea por **tipo ingerido**
  (`text` → citas, `tabular` → métricas), no por el label `kind`. `resolveDiscoverySources` usa
  `sources/files/` si el manifest tiene fuentes `subido|ingerido`; si no, cae a `samples/`.
  `runDiscoveryWithSources` orquesta resolver → Agente 1 → marcar `ingerido` (makeRunner inyectable
  para tests). El CLI `discover` usa el seam y reporta el origen.
- **W1.4 (UI):** página `/spec/:id/fuentes` (nav nuevo): dropzone drag&drop + picker (POST multipart),
  lista con badge de tipo/tamaño/estado/etapas, reclasificar `kind` (PATCH), descartar lógico (DELETE).
- **Diferido (acoplado):** modal selector reutilizable + botón "Correr Descubrimiento desde la UI"
  (requiere endpoint que llame al Agente 1 real → mover credenciales/llamadas al modelo al server;
  se pospuso por decisión explícita). El selector no tiene consumidor hasta que exista ese botón.

### Fase D2 · Sesión 5 (W2.1+W2.2) ✅ — estados de revisión por hallazgo

- **Esquema:** `finding` gana `review_status (pendiente|aprobado|rechazado|en_pausa`, default
  `pendiente`) y `reviewed_at`; **reusa** `reviewed_by` (quién) y `review_note` (comentario). Default
  → specs previas cargan sin romper; `derive.ts` usa `safeParse` (defaults aplican solos).
- **Orquestador:** `reviewFinding(status, comment, by)` setea el estado **en su lugar** (no borra),
  espeja en la propuesta si existe, **exige comentario** para `rechazado`/`en_pausa` (extiende inv. 7),
  audita `finding.approve|reject|pause|resume`. `rejectFinding` se reimplementó sobre
  `reviewFinding(rechazado)`: **ya no destruye** (recuperable).
- **API/CLI:** `PATCH /api/specs/:id/findings/:fid/review {status, comment, by}` (400 inválido/sin
  comentario) + CLI `review <spec> <fid> --status [--reason] [--by]`.
- **UI (tweak mínimo, la triage plena es W2.4):** `FindingsTriage` oculta los `rechazado` (preserva la
  UX "rechazar lo saca de la vista"); conteo/empty usan los visibles.
- **Migración (decisión confirmada):** los 8 findings de `otp-onboarding/spec.yaml` → `aprobado`;
  la propuesta/working set quedan `pendiente` por default.

### Fase D2 · Sesión 6 (W2.3+W2.4) ✅ — gate respeta estados + UI de triage plena

- **W2.3 (gate):** `reviewVerification` agrega un criterio **bloqueante** "Sin hallazgos de impacto
  alto pendientes ni en pausa" (high en `pendiente|en_pausa` bloquea) + **advertencia no bloqueante**
  para `medium/low` en pausa (umbral confirmado). `reviewFinding` **recomputa `proposed.verification`**
  al espejar → el gate (que lee el stored) bloquea/desbloquea en vivo. Migración: recomputada la
  verificación de la propuesta de otp-onboarding → su compuerta arranca **bloqueada** (5 high pendientes).
- **W2.4 (UI):** `FindingsTriage` plena — Aprobar / Pausar / Rechazar por tarjeta (las dos últimas
  abren `ReviewCommentModal` de comentario obligatorio), Reabrir → pendiente; badge semántico
  (verde/rojo/ámbar/gris) + tooltip; filtros por estado (chips) y contadores. `VerificationPanel`
  pinta el fail no-bloqueante como advertencia (⚠ ámbar).

### Fase D2 · Sesión 7 (W3.1+W3.2) ✅ — rediseño visual: tokens + layout modular

- **Hallazgo de auditoría previo:** shadcn/Tailwind NO estaban instalados (el anexo lo asumía).
  **W3.1 incluyó el bootstrap**: Tailwind v4 (`@tailwindcss/vite`) + `tw-animate-css` (dev) y
  `class-variance-authority`/`clsx`/`tailwind-merge`/`lucide-react`/`radix-ui` (runtime), alias `@/`
  (vite + tsconfig), `components.json`. **7 componentes stock SIN editar** (`components/ui/`):
  card, badge, breadcrumb, tabs, separator, tooltip, button. Desde acá rige "cero deps nuevas de UI".
- **Tokens (`globals.css` = ÚNICO punto de personalización, ANEXO §0/§1):** tema claro único —
  `--background hsl(210 33% 97%)` (gris-azulado), `--card` blanco puro, `--primary hsl(217 80% 50%)`
  (azul sobrio, confirmado sobre slate), `--border hsl(214 20% 90%)`, `--muted-foreground` slate-500
  (piso de contraste), `--radius 0.75rem`. **El tema oscuro se ELIMINÓ** (decisión cerrada del plan;
  no se generan vars `.dark`). Los colores semánticos NO son tokens: clases Tailwind — real=emerald,
  mock=amber, aprobado/rechazado/en_pausa/pendiente=emerald/red/amber/slate, cita=sky, cálculo=violet.
- **W3.2 (layout):** breadcrumb stock persistente (`SpecBreadcrumb`, deriva `<spec>/<etapa>/<sección>`
  de la URL) + contenido centrado `max-w-5xl`. Overview = pila de Cards con header propio
  (icono lucide + título + badge + contador) — Spec viva, Problem statement, Outcomes, JTBD, Alcance,
  Tareas, Historial — + **Pipeline clickeable** (filas-link con hover) + Auditoría como Card.
  Etapas reales migradas: triage (filtros pill, tooltip de revisión, acciones outline semánticas),
  **evidencia con jerarquía corregida (§2: cita/cálculo a `text-sm` foreground, locator chip
  `Badge outline font-mono`)** — también dentro de las tarjetas del triage —, verificación con
  iconos (✓/✗/⚠/·), compuerta (caja dashed ámbar; Aprobar=primary, Iterar=outline), enmarcado/JTBD/
  métricas como Cards. `SectionTabs` = Tabs stock sincronizadas con la URL.
- **Provisorio (muere en sesión 8):** `badges.tsx` (RealMock/ReviewStatus/Confidence/EvidenceKind
  como composición sobre Badge stock) → migran a variantes cva de `ui/badge.tsx`; `styles.css`
  legado envuelto en `@layer base` con vars remapeadas a los tokens — solo le quedan sidebar,
  home, fuentes, placeholder mock y modales.

### Fase D2 · Sesión 8 (W3.3+W3.4+W4.1 + impulso visual) ✅ — chips cva, drawer y salto visual

El sistema queda correcto Y se ve como producto (referencia Stratify), sin salir de shadcn-stock.

- **W3.3 (chips):** 11 variantes cva en `ui/badge.tsx` (ÚNICA edición permitida de `ui/`):
  `real|aprobado|mock|enPausa|rechazado|pendiente|cita|calculo|quantitative|qualitative|heart`.
  Nombradas por semántica, no por color; par uniforme `border-{c}-200 bg-{c}-50 text-{c}-700`.
  **Paleta final (contraste texto/fondo medido, AA ≥4.5):** real/aprobado=emerald (5.09), mock/
  enPausa=amber (4.87), rechazado=red (5.88), pendiente=slate-token (6.51), cita=sky (5.49),
  calculo=violet (6.64), quantitative=indigo (7.22), qualitative=teal (5.17), heart=rose (5.51).
  `badges.tsx` delega TODO el color a las variantes (cero clases sueltas); agrega `FindingTypeBadge`,
  `HeartBadge`, `SourceKindBadge`. **Mapa de iconos por concepto** en `icons.tsx`:
  etapa (Compass/Target/Lightbulb/PenTool/FlaskConical/PackageCheck/GraduationCap), fuente
  (FileText/Table2/MessageSquareQuote/File), evidencia (Quote/Calculator), HEART (Smile/Activity/
  UserPlus/Repeat2/CircleCheck), agente (Bot). `<SectionIcon>` = icono en contenedor suave
  (`bg-{c}-50 text-{c}-600`, AA 3:1 gráfico).
- **Impulso visual (composición stock):** iconos tintados en todos los headers de Card/etapa;
  fila de **stat-cards** en el overview (`StatCards`: versión, hallazgos con desglose por estado,
  JTBD, métricas); cards interactivas (`hover:bg-muted/50` + `hover:border-primary/30`) en pipeline,
  home y fuentes; **avatares de actor** en Auditoría (`ActorAvatar`: humano con iniciales de color
  estable por hash, agente/sistema con icono Bot neutro); header de etapa expresivo (círculo
  numerado size-12 + icono, título text-2xl, subtítulo muted).
- **W3.4 (microcorrecciones):** el resumen de auditoría del overview muestra SOLO la actividad
  desde la última `agent.proposed` ("Auditoría de la propuesta") + footer "Ver todo el log (N) →"
  a `/auditoria`; leyenda real/mock vía el sidebar persistente; numeración/subtítulo de etapa se
  mantienen.
- **W4.1 (drawer):** `FindingDrawer` con **Sheet stock** (lado derecho): cadena completa
  evidencia → cita/cálculo → fuente con locator, historial de revisión (estado/revisor/comentario/
  fecha) y **trazabilidad inversa real** (JTBD que citan el hallazgo vía `supported_by`; las
  métricas v0 NO ligan hallazgo→métrica, no se inventan links). La tarjeta del triage queda
  compacta (badges + título + "Ver detalle →" + acciones) y abre el drawer; guarda el id (no el
  objeto) para reflejar el estado nuevo tras un refetch. Esc + foco atrapado + click-afuera (stock).
- **Migración legado:** sidebar, home, fuentes y placeholder pasaron a shadcn/Tailwind + shell grid
  en Tailwind. `styles.css` quedó SOLO con los modales legados (`.modal*`, `button.primary`) —
  mueren en la sesión 9 (W4.2 → Dialog stock). `git diff` de `ui/`: único modificado = `badge.tsx`;
  `sheet.tsx`/`avatar.tsx` son stock nuevo SIN editar (sancionados por ANEXO §0.4 + W4.1/avatares).

### Fase D2 · Sesión 11 (W6.1+W6.2 — intake de spec) ✅ — enmarcado del discovery + grounding

Adelantada antes de W4.2/W5: la Fase 3 no arranca sin W6 (los agentes nuevos deben nacer leyendo
el intake). Crear una spec deja de ser metadatos y pasa a enmarcar el discovery; su output alimenta
al motor. Hoy: esquema + grounding + completitud (el wizard UI es la sesión 12).

- **Esquema final del intake** (`schema.ts`, opcional → specs previas cargan sin migrar):
  ```
  intake: { researchQuestion (obligatoria), hypotheses[], productContext?,
            discoveryPlan: { methods[], instruments[], expectedSourceKinds[] } } | null
  methods     = entrevistas | encuestas | analitica | benchmark | soporte | otros
  instruments = nps | ces | csat | isn | otros   (satisfacción; mapeo HEART = Agente 2, no hoy)
  ```
  `SourceKindSchema` se **movió a schema.ts** (vocabulario core compartido con el intake; evita
  import circular) y ganó el kind **`persona`** (artefacto subible como EVIDENCIA citable, nunca
  grounding; como `entrevista`, no se auto-infiere). `deriveExpectedSourceKinds(methods)` = mapa
  determinista (entrevistas→entrevista; encuestas/analitica→datos; benchmark/soporte→documento;
  otros→∅), unión deduplicada.
- **Grounding del Agente 1 (W6.2a):** el intake (researchQuestion + productContext + hypotheses) se
  inyecta SOLO en el prompt de **derivación** (`derive.ts`: regla de foco en el system + bloque en
  el mensaje); la **extracción no se toca** (invariante 3: la evidencia se extrae sin sesgo, el
  grounding solo orienta QUÉ derivar del pool ya fijo). `createDiscoveryRunner` lo deriva de
  `current.intake`; sin intake → `undefined` → derivación idéntica a la previa (sin regresión).
- **Completitud (W6.2b):** `computeSourceCompleteness` compara `expectedSourceKinds` (plan) vs. los
  kinds subidos (no descartados); `PATCH /api/specs/:id/intake` (auditoría `intake.update`) +
  `GET …/sources/completeness`. UI: indicador en el hub de Fuentes con chips "falta: <tipo>"
  reusando variantes de Badge (cero edición de `ui/`).
- **Resultado de la comparativa (real, samples OTP, mismo pool de 16 anclajes, aislando la variable
  al grounding):** SIN intake = 10 hallazgos más planos y dispersos (biométrica como medium, reenvío
  como medium/constraints). CON intake = 9 hallazgos ordenados por relevancia a la pregunta: el
  **reenvío deficiente sube a high/hypothesis** (atado a la hipótesis 3), el **feedback en pantalla**
  se nombra explícito, la **biométrica off-question baja a low/scope**. Sin inventar evidencia (mismas
  citas/cálculos). Outputs en `/tmp/intake-ab/` + harness reproducible `scripts/intake-ab.mjs`.

### Fase D2 · Sesión 9 (W4.2+W4.3 — modales Dialog + accesibilidad) ✅ — muere el CSS legado

- **W4.2 (modales con propósito único):** `NewSpecModal` y `ReviewCommentModal` migrados a **Dialog
  stock** (Input/Label/Textarea/Button). **Confirmación de compuerta** (`GateApproveDialog`): resumen
  de lo que se aprueba ANTES del commit — versión destino (v+1), conteos (JTBD/métricas/hallazgos) y la
  lista de criterios de verificación con pass/fail — + campo de aprobador. Modal de **iterar** (feedback)
  y de **descarte de fuente** (motivo opcional). Resultado: **cero `window.prompt`** en el dashboard.
- **styles.css ELIMINADO** entero + su import en `main.tsx` (mueren `--legacy-muted`/`--legacy-accent`).
  Todo el dashboard es shadcn/Tailwind; no queda una sola clase CSS legada.
- **W4.3 (accesibilidad):** foco atrapado + cierre con Esc + restauración de foco los traen Dialog/Sheet
  stock (verificado); navegación por teclado en el triage = botones nativos (Ver detalle/Aprobar/Pausar/
  Rechazar focusables; Enter abre el drawer). **Shim de compat React 18** (`forwardRef` en `DialogOverlay`
  y `SheetOverlay`) → desaparece el warning dev-only "Function components cannot be given refs" que dejó
  W4.1 (el template shadcn@latest apunta a React 19). Stock nuevo SIN editar: dialog/input/label/textarea.

**Tests:** ~109 (spec 60 · agent1 23 · agent2 3 · orchestrator 22). Lógica anti-alucinación testeada
offline (stubs) + verificada con corridas reales contra la API. El CRUD multi-spec, el hub de Fuentes,
los estados de revisión y el bloqueo del gate (block→unblock) se verificaron además live por curl/CLI;
routing, home, Fuentes y la triage plena (aprobar/pausar/rechazar/filtros) en el preview. La ingestión
W1.3 se verificó **offline** (runner stub, sin tokens).

## 5. Estado actual del repo

- Spec `otp-onboarding`: **v3 approved**, producto **Onboarding**, etapa `definicion`, con una
  **propuesta de Definición pendiente** (8 hallazgos en la spec, 5 JTBD, propuesta `in_review`).
  **Ready-to-demo** en `http://localhost:5173/spec/otp-onboarding`.
- Multi-spec operativo por API/CLI **y por UI**: home "Mis specs" en `/`, crear/cambiar de spec sin
  terminal, contexto aislado por URL (`/spec/:id/...`). El índice `specs/index.yaml` es cache
  regenerable y está **gitignored**.
- Hub de Fuentes operativo de punta a punta por UI: subir (drag&drop), listar, reclasificar,
  descartar; y `discover` (CLI) ya lee las fuentes subidas (cae a `samples/` si no hay) y marca
  `ingerido`. Falta el botón "Correr Descubrimiento desde la UI" (diferido).
- Revisión por hallazgo completa: por API/CLI **y por UI** (triage plena: aprobar/pausar/rechazar con
  modal de comentario, badges, filtros, contadores; no-destructivo, auditado). El **gate respeta los
  estados**: bloquea con high `pendiente|en_pausa`, advierte con medium/low en pausa.
- **otp-onboarding**: su propuesta de Definición arranca con el **gate bloqueado** mientras haya
  hallazgos high `pendiente|en_pausa`. El demo es: revisar/aprobar los high en el triage → el gate
  se desbloquea → aprobar. (Ojo: el triage en vivo muta `findings.yaml`/`spec.proposed.yaml`/
  `audit.jsonl`; para resetear el demo, `git restore specs/`.)
- **Piel nueva (sesiones 7–8):** tema claro shadcn en TODO el dashboard. Sistema de chips = variantes
  cva de Badge (AA verificado); iconos tintados por concepto; stat-cards y cards interactivas;
  avatares de actor en auditoría; drawer de hallazgo (Sheet) con cadena de evidencia + trazabilidad
  inversa. Modales en Dialog stock (NewSpec, comentario de revisión, confirmación de compuerta, iterar,
  descarte) con foco atrapado y Esc; **`styles.css` eliminado** — el dashboard es 100% shadcn/Tailwind,
  cero CSS legado. Home del dashboard: `http://localhost:5173`.
- **Intake (sesión 11):** la spec puede llevar un `intake` (pregunta de discovery + plan); cuando
  existe, el Agente 1 deriva hallazgos orientados a la pregunta (grounding solo en derivación) y el
  hub de Fuentes muestra la completitud (esperado-vs-subido). `otp-onboarding` sigue **sin intake**
  (carga con `intake: null`, demo-able). El wizard que lo carga desde la UI llega en la sesión 12;
  hoy se setea por `PATCH /api/specs/:id/intake`.

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
- **Ingestión (D2·W1.3):** el runner de Descubrimiento rutea por **tipo ingerido** (`text`/`tabular`),
  NO por el label `kind` de la fuente (robusto: una fuente mal clasificada igual se procesa bien).
  `runDiscoveryWithSources` es el seam reutilizable (CLI hoy; el endpoint de discover-desde-UI lo
  reusaría). `computeFunnelMetrics` asume estructura tipo funnel: con un CSV arbitrario puede no
  derivar métricas útiles (a revisitar si las fuentes reales no son funnels).
- **Subir archivos en el preview:** los `<input type=file>` no se pueden llenar con `preview_fill`;
  para probar el onChange real, crear un `DataTransfer`, `input.files = dt.files` y disparar
  `change` vía `preview_eval` (Chromium lo permite).
- **Revisión por hallazgo (D2·W2):** `review_status` arranca `pendiente` (default zod → specs previas
  cargan). `rechazado`/`en_pausa` exigen comentario en `reviewFinding` (no en `aprobado`/`pendiente`).
  `reviewFinding` espeja el estado en `findings.yaml` Y en `spec.proposed.yaml` si hay propuesta.
  **`rejectFinding` ya NO borra** (enruta por `reviewFinding(rechazado)`): si algo esperaba que el
  hallazgo desapareciera del store, ahora queda con status `rechazado`. La triage UI lo oculta por
  ahora; cuando W2.3 toque el gate, recordar que los `rechazado` siguen en el array de findings.
- **Agregar campos a `finding`/`Spec` rompe los fixtures tipados:** los literales `: Finding`/`: Spec`
  de los tests exigen los campos nuevos (el tipo `infer` los pide aunque tengan `.default()`).
  Al extender el esquema, actualizar los fixtures (hay varios en spec/agent2/orchestrator tests).
- **Gate y verificación (D2·W2.3):** la compuerta lee `proposed.verification` **almacenada**, no la
  recomputa para mostrarse (sí la recomputa `approveGate` al aprobar). Por eso `reviewFinding` recomputa
  y reescribe `proposed.verification` al cambiar un estado — si agregás otra acción que afecte la
  verificación, recordá recomputarla o la UI quedará desincronizada. Al cambiar `verifyProposal`,
  recomputar la verificación de las propuestas vivas existentes (hay un one-off para otp-onboarding).
- **Umbral del gate:** high en `pendiente|en_pausa` bloquea; medium/low en pausa solo advierte
  (criterio `blocking:false`, status `fail`, se ve ámbar). Si cambia el umbral, tocar
  `reviewVerification` en `verify.ts`.
- **shadcn (D2·W3.1):** el setup vive en `apps/dashboard` (`components.json`, alias `@/` en vite y
  tsconfig). Agregar componentes: `pnpm dlx shadcn@latest add <comp> --yes` (instaló el paquete
  umbrella `radix-ui`; NO agregar `@radix-ui/*` sueltos). `components/ui/*` no se edita — única
  excepción futura: variantes cva de `badge.tsx` (sesión 8).
- **CSS legado vs Tailwind v4 (D2·W3):** las reglas SIN `@layer` le ganan a TODAS las utilidades
  (que viven en capas). Por eso `styles.css` está envuelto en `@layer base` — si se agrega CSS
  suelto fuera de capa, pisará los `className` de Tailwind (un `a {color}` global rompió
  `text-foreground` hasta ese fix).
- **Radix escucha `pointerdown` (D2·W3):** `preview_click` y `el.click()` no disparan los triggers
  de Radix (Tabs, etc.) en el preview; usar `PointerEvent` vía `preview_eval` para probarlos
  (el click humano real funciona normal). El `Tooltip` stock exige `TooltipProvider` (está en
  `main.tsx`).
- **Semánticos sin token (D2·W3.1):** real/mock/revisión/evidencia van como clases Tailwind
  (hoy centralizadas en `src/components/badges.tsx`), NO como CSS vars nuevas — mantener así
  hasta que la sesión 8 las convierta en variantes cva de Badge. Usar tono **-700** (emerald/amber/
  red) para texto de badge chico: -600 sobre fondo claro queda en ~3.5:1 (debajo de AA).
- **Colisión de tokens legado↔shadcn (D2·W3 fix):** el `:root` de `globals.css` NO está en `@layer`,
  así que **le gana** al `@layer base` de `styles.css`. NO reusar en el remap legado nombres que
  ya son tokens shadcn (`--muted`, `--accent`): resolvían al gris claro shadcn → texto/links
  ilegibles. Por eso se renombraron a `--legacy-muted` (= slate-600, AA en 11-12px) y
  `--legacy-accent` (= primary). Al matar `styles.css` en la sesión 8 estas vars desaparecen.
  También se removió la regla global `a { color }` (pisaba los links de shadcn, p. ej. breadcrumb).
- **Contraste del texto secundario (D2·W3 fix):** `--muted-foreground` se subió de slate-500 a
  **slate-600** (`hsl(215 19% 35%)`) para que el texto muted pase AA también sobre fondos tintados
  (`bg-muted`, `--background`), no solo sobre tarjetas blancas. El anexo pide "no bajar" el
  contraste; oscurecer lo eleva. Si se vuelve a slate-500, revisar los muted sobre fondo no-blanco.
- **Medir contraste en el preview:** `getComputedStyle().color` devuelve **oklch** para clases
  Tailwind de color (emerald/amber) y el canvas del preview tampoco lo parsea → da falsos "ratio 1".
  Saltar los oklch en el scan y medir esos badges a mano (emerald-700/-50 = 5.26:1, amber-700/-50 =
  4.82:1). Fondos `/50` (translúcidos, p. ej. `bg-amber-50/50`) también rompen el parser: blendear
  sobre la tarjeta blanca antes de calcular. **W3.3:** para medir las 11 variantes de golpe se
  implementó la conversión **oklch→sRGB lineal→luminancia** en JS dentro de `preview_eval` (matrices
  estándar de oklab) y se computó el contraste WCAG — método repetible para auditar AA sin canvas.
- **Variantes cva de Badge (D2·W3.3):** son la ÚNICA edición permitida de `components/ui/`. Nombrar
  por SEMÁNTICA (no por color): `real/aprobado/mock/enPausa/...`. `aprobado`≈`real` (verde) y
  `enPausa`≈`mock` (ámbar) comparten clases a propósito. Se separó **evidencia** (cita=sky/cálculo=
  violet) de **tipo de hallazgo** (quantitative=indigo/qualitative=teal) para no confundirlos en la
  misma tarjeta. Todo color semántico nuevo vive como variante acá, NO inline en componentes.
- **Avatares de actor (D2·paso 2d):** `ActorAvatar` decide humano vs agente con un regex sobre el
  nombre (`/agent|agente|ia|bot|modelo|orquestador|orchestrator|sistema|system/i`). Humano = iniciales
  con tono `bg-{c}-100 text-{c}-700` (AA, amber el más justo a 4.54); agente/sistema = icono Bot sobre
  `bg-muted`. Si un actor nuevo es máquina y no matchea, agregalo al regex o saldrá como humano.
- **Shim React 18 en los Overlay (D2·W4.3, resuelto):** el template shadcn@latest apunta a React 19
  (refs como prop), pero el proyecto pinea **React 18.3** → Radix le pasaba un ref a `DialogOverlay`/
  `SheetOverlay` (componentes función planos) y avisaba `Function components cannot be given refs`. Se
  resolvió envolviendo ambos Overlay en `forwardRef` (`dialog.tsx`/`sheet.tsx`) — shim de compat, cero
  cambio visual/funcional. Son las ÚNICAS ediciones a mano de `components/ui/` además de las variantes
  cva de `badge.tsx`. Si se sube a React 19, el shim se puede revertir (deja de ser necesario).
- **Resumen de auditoría del overview (D2·W3.4):** muestra solo la rebanada desde la última entrada
  `agent.proposed` (`audit.lastIndexOf`), no el log completo — evita conteos confusos de iteraciones
  viejas. El verbo que marca "propuesta nueva" es `agent.proposed` (lo escribe `stage.ts`); si cambia,
  actualizar el filtro en `OverviewPage`. El log completo vive en `/auditoria` ("Ver todo el log").
- **styles.css ELIMINADO (D2·W4.2):** el CSS legado murió entero al migrar los últimos modales a Dialog
  stock; ya no existe `apps/dashboard/src/styles.css` ni su import. Todo el dashboard es shadcn/Tailwind:
  no hay clases `.modal*`/`.primary`/`.panel`/etc. ni `--legacy-*`. Cualquier estilo nuevo va como
  utilidad Tailwind o token en `globals.css` (único punto de personalización).
- **Intake opcional, cero migración (D2·W6.1):** `intake` es `nullable + default(null)` → toda spec
  previa (otp-onboarding incluida) carga con `intake: null` sin tocar el YAML. `createSpecV0` arranca
  con `intake: null`. Al agregar `intake` a `SpecSchema` se rompió un fixture tipado (`: Spec`) en
  `schema.test.ts` — el patrón de siempre: los literales tipados exigen el campo nuevo aunque tenga
  default. Si extendés el intake, revisá esos fixtures.
- **SourceKind movido a schema.ts (D2·W6.1):** el vocabulario `documento|datos|entrevista|persona|otro`
  vive en `schema.ts` (lo comparte el intake); `sources.ts` lo **re-exporta** (`export { SourceKindSchema }`)
  para no romper imports `from "@pda/spec"`. OJO con `export *`: funciona porque `sources.ts` re-exporta
  el MISMO binding de `schema.ts` (no una redefinición) → sin conflicto de nombres. `persona`, como
  `entrevista`, NO se infiere en `inferKind` (lo clasifica el humano). Al sumar un kind, tocá: `inferKind`
  (si aplica), `SOURCE_KIND_ICON`, los arrays `SOURCE_KINDS`/`KINDS` (server + SourcesPage) y el mapa
  `METHOD_TO_KINDS`.
- **Grounding SOLO en derivación (D2·W6.2):** el intake entra en `derive.ts` (foco de QUÉ derivar),
  NUNCA en `extract.ts` (la evidencia se extrae sin sesgo, invariante 3). El seam es
  `FindingsProposer.propose({ ..., grounding? })`; `createDiscoveryRunner` lo arma de `current.intake`.
  Para auditar el efecto sin que el modelo de extracción sea variable, `scripts/intake-ab.mjs` extrae
  UNA vez y deriva dos veces (sin/con) sobre el mismo pool — repetir así cualquier A/B de prompts.
- **updateIntake NO commitea ni reindexa (D2·W6.2):** espeja a `updateSpecMeta` (writeSpec + appendAudit),
  pero NO regenera el índice (el intake no es campo del índice) ni hace `git commit` (el versionado real
  es solo al aprobar compuerta). El server lee de disco, así que el cambio se ve sin commit. Si `intake`
  pasara a influir el índice, agregar `regenerateIndex`.
- **Completitud = manifest real (D2·W6.2b):** `computeSourceCompleteness` cuenta solo fuentes NO
  descartadas; sin intake o sin `expectedSourceKinds` → `satisfied:true` (nada exigido) y el indicador no
  se muestra. `expectedSourceKinds` se DERIVA en `updateIntake` cuando viene vacío + hay métodos, pero es
  editable (si el cliente manda tipos explícitos, se respetan).
- **Verificar API con RTK/curl (gotcha de tooling):** el hook RTK reformatea la salida de `curl` a una
  vista tipo-esquema (no JSON crudo) → `python -m json.tool`/`jq` sobre ese output fallan. Para leer
  respuestas crudas en verificación, usar `node -e "fetch(...).then(r=>r.json()).then(...)"` en vez de curl.

## 8. Qué falta — próximos pasos

### Inmediato: Fase D2 (experiencia del dashboard) — bloquea la Fase 3

Se ejecuta COMPLETA antes de arrancar agentes nuevos. Plan: [PLAN-FASE-D2-experiencia-dashboard.md](PLAN-FASE-D2-experiencia-dashboard.md).

- **Sesión 1 (W0.1+W0.2) — HECHA:** índice + CRUD multi-spec (API/CLI).
- **Sesión 2 (W0.3+W0.4) — HECHA:** routing `/spec/:id` con aislamiento de contexto + home
  "Mis specs" + modal "Nueva spec" + switcher.
- **Sesión 3 (W1.1+W1.2) — HECHA:** modelo + API del hub de Fuentes (multipart, auditado).
- **Sesión 4 (W1.3+W1.4) — HECHA:** ingestión desde fuentes (cae a samples) + UI página "Fuentes".
- **Sesión 5 (W2.1+W2.2) — HECHA:** estados de revisión por hallazgo + API/CLI (no-destructivo).
- **Sesión 6 (W2.3+W2.4) — HECHA:** gate respeta estados + UI de triage plena. **Diferido:** "Iterar"
  con comentarios por ítem (JTBD/métrica) en la compuerta de Definición (el iterate de texto libre ya
  funciona) — follow-up acotado de W2.3.
- **Sesión 7 (W3.1+W3.2) — HECHA:** bootstrap shadcn/Tailwind v4 + tokens claros (oscuro eliminado)
  - layout modular (Cards con header, breadcrumb, pipeline clickeable, jerarquía de evidencia §2).
    La skill `frontend-design` que menciona el plan NO existe en el entorno; la dirección la cubrió
    el ANEXO-D2 §1.
- **Sesión 8 (W3.3+W3.4+W4.1 + impulso visual) — HECHA:** 11 variantes cva de Badge (AA verificado),
  mapa de iconos lucide + `<SectionIcon>`, stat-cards, cards interactivas, avatares de actor, header
  de etapa expresivo; auditoría del overview acotada a la última propuesta; drawer de hallazgo
  (Sheet) con cadena evidencia→fuente + historial + trazabilidad inversa JTBD; migradas las últimas
  superficies legadas (sidebar/home/fuentes/placeholder). `styles.css` quedó solo con los modales.
- **Sesión 11 (W6.1+W6.2 — intake) — HECHA (adelantada antes de W4.2/W5):** esquema `intake` opcional
  (researchQuestion + hypotheses + productContext + discoveryPlan con methods/instruments/
  expectedSourceKinds) + kind `persona`; grounding del Agente 1 SOLO en la derivación; completitud de
  fuentes + `PATCH …/intake` (auditoría `intake.update`) + indicador con chips "falta:" en Fuentes.
  Comparativa real validó el efecto del grounding (ver Sesión 11 arriba). Falta el wizard UI (sesión 12).
- **Sesión 9 (W4.2 + W4.3) — HECHA:** modales a Dialog stock + confirmación de compuerta + iterar +
  descarte (cero `window.prompt`); `styles.css` eliminado entero; a11y (foco atrapado/Esc/teclado) +
  shim React 18 que cierra el warning de refs de W4.1.
- **Sesión 10 (W5) — PRÓXIMA (skipped, se hace ahora):** capa de usuario mock (login, avatar, perfil,
  settings; identidad real firma la auditoría — `reviewedBy`/`uploadedBy`/`--by` y el actor del
  `intake.update`).
- **PRÓXIMA = Sesión 12 (W6.3 + W6.4 — wizard + retrofit):**
  - **W6.3 (wizard UI, 5 pasos):** stepper propio (shadcn no trae Stepper; números/checks, sin deps
    nuevas): Identidad → Enmarcado (pregunta obligatoria, hipótesis, contexto) → Plan de discovery
    (checklist de métodos; deriva `expectedSourceKinds` con `deriveExpectedSourceKinds`, editable;
    **plantillas deterministas, SIN modelo**) → Fuentes (reusa el modal del hub W1) → Resumen→crear
    (commit v0 con intake + `spec.create` enriquecida). El overview "Spec viva" muestra la
    researchQuestion como encabezado de contexto. Usar el cliente `patchIntake` ya cableado.
  - **W6.4 (retrofit):** pantalla "editar intake" (pasos 2–3 como formulario) para specs previas;
    ya existe `PATCH …/intake` con auditoría `intake.update`.
  - Cerrar con **re-ensayo del guión de demo** (paso 0 nuevo: crear por wizard; <12 min).

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
