# PLAN — Fase D2: Experiencia del dashboard (fuentes, revisión humana granular, rediseño modular)

> Plan de ejecución para Claude Code. Complementa CLAUDE.md y el PRD; **no los reemplaza**.
> **Secuencia: esta fase se ejecuta COMPLETA antes de iniciar la Fase 3 (diamante Solución).**
> No se arranca ningún agente nuevo (Exploración/Diseño/Validación) hasta cerrar W0–W5 y ensayar
> el guión de demo. Razón: la Fase 3 construirá sobre el modelo multi-spec, las fuentes y los
> estados de revisión definidos aquí; hacerlo al revés obliga a migrar tres agentes nuevos.
> Metodología: planificar → confirmar → construir, en pasos chicos y verificables.
> Cada paso termina con `pnpm typecheck && pnpm -r test` en verde y un commit.

## 0. Contexto y motivación

El motor (Agentes 1 y 2 + orquestador + compuertas) ya es real y demostrable. Esta fase invierte en la
**capa de experiencia** para demos a stakeholders, con tres carencias detectadas:

1. **No hay gestión de fuentes**: los documentos viven en `samples/` sin UI. Falta un hub donde el
   usuario suba sus PDF/XLSX/CSV/DOCX/TXT y los asocie al proyecto (referencia: patrón
   "select sources to chat with" de Stratify).
2. **La revisión humana es binaria y de grano grueso**: hoy solo existe rechazar hallazgo y
   aprobar/iterar compuerta. Falta el ciclo completo por ítem: **aprobar / rechazar / pausar /
   pendiente**, con comentario y estado visible, persistido y auditado.
3. **Look & feel denso y oscuro**: todo concentrado, jerarquía visual débil. Falta modularidad tipo
   Stratify: tarjetas por tipo de contenido, badges de tipo, claridad de "dónde estoy", superficies
   secundarias (modales, paneles laterales) en lugar de apilar todo en la página.
4. **Una sola spec hardcodeada**: el dashboard vive pegado a `otp-onboarding`. Un producto puede
   tener varias specs trabajándose en paralelo; falta un CRUD de specs con agrupación por producto
   y un switcher para moverse entre ellas **sin que se mezcle el contexto** (cada spec con sus
   fuentes, hallazgos, propuestas y auditoría propios).
5. **No hay capa de usuario**: falta el mockup estándar de sesión — login, avatar, nombre, rol,
   menú de cuenta y configuración — que toda demo de producto necesita para sentirse real.

## 1. Invariantes de esta fase (además de los 7 del proyecto)

- **U-1**: Todo estado de revisión y comentario se persiste en el spec store y genera entrada de
  auditoría. Nada de estado solo-UI.
- **U-2**: La compuerta NO puede aprobarse con ítems `pendiente` o `en_pausa` de impacto alto
  (verificación bloqueante nueva). Rechazar y pausar exigen comentario (extiende invariante 7).
- **U-3**: El etiquetado real/mock sobrevive al rediseño. Nada en la nueva piel puede sugerir que
  las etapas 3–7 están implementadas.
- **U-4**: Las fuentes subidas son la entrada real del Agente 1 (reemplazan `samples/` cuando
  existen). No se duplica la lógica de ingestión: el hub alimenta el pipeline existente.

## 2. No-objetivos (para contener el alcance)

- No se implementan etapas 3–7 ni conectores externos (MCP/OAuth) — sigue en Fase 3+.
- No hay máquina de estados por ítem dentro de la propuesta de Definición (JTBD/métricas): el grano
  por ítem aplica a **hallazgos**; en Definición se mantiene aprobar/iterar a nivel propuesta, pero
  "Iterar" pasa a aceptar **comentarios por ítem** que se inyectan como feedback al agente.
- No RBAC ni multiusuario: el revisor sigue siendo un nombre configurable (`--by`).

## 3. Workstreams y orden

Orden recomendado: **W0 → W1 → W2 → W3 → W4 → W5** (primero los cambios de esquema/store/routing,
después la piel). Razón: W0–W2 tocan `packages/spec`, el server y el routing; conviene estabilizar
modelo de datos y navegación antes de invertir en componentes visuales que los rendericen.

---

### W0 — Gestión de specs (CRUD multi-spec, agrupación por producto)

**Resultado**: el dashboard deja de estar pegado a una spec; se pueden crear, listar y archivar
specs, agrupadas por producto, y cambiar entre ellas sin mezclar contexto.

- **0.1 Modelo**: el store ya soporta `specs/<id>/` — falta exponerlo. Agregar al esquema de spec
  los metadatos `product` (string, agrupador) y `description?`; índice ligero
  `specs/index.yaml` (zod) con `id, name, product, stage, status (activa|archivada), updatedAt`
  regenerable desde el filesystem (el índice es cache, el directorio es la verdad).
  Hecho cuando: esquema + tests; el índice se reconstruye si se borra.
- **0.2 API + CLI**: `GET /api/specs` (lista agrupada por producto), `POST /api/specs` (crear:
  id kebab-case validado, nombre, producto, descripción), `PATCH /api/specs/:id` (metadatos),
  archivar = `status: archivada` (soft delete, nunca se borra el directorio — auditoría y git
  conservan todo). Verbos de auditoría `spec.create|update|archive`. CLI espejo (`create-spec`).
  Hecho cuando: crear una segunda spec por curl y verla listada junto a `otp-onboarding`.
- **0.3 Routing y aislamiento de contexto**: todas las rutas pasan a `/spec/:id/...`
  (etapas, fuentes, auditoría). El estado de UI (filtros, tabs) se namespacea por spec. Cada spec
  resuelve sus propias fuentes, hallazgos, propuestas y log — **cero estado compartido** salvo el
  índice. Redirect de `/` al listado de specs.
  Hecho cuando: dos specs abiertas en pestañas distintas no se pisan; refresh conserva dónde estabas.
- **0.4 UI**: pantalla **"Mis specs"** como home — tarjetas agrupadas por producto con nombre,
  etapa actual, badge de estado, propuesta pendiente si la hay, y CTA "Nueva spec" (modal de
  creación con producto existente o nuevo). En el sidebar, el bloque de meta actual se convierte en
  **switcher de spec** (dropdown: specs del mismo producto + "ver todas"). Patrón de referencia:
  el selector de teams/workspaces de Stratify (imagen 2).
  Hecho cuando: crear spec desde la UI → subir fuentes → correr Descubrimiento, todo sin terminal.

### W1 — Hub de Fuentes (subir y asociar documentación)

**Resultado**: sección "Fuentes" en el sidebar + selector modal tipo Stratify; los archivos subidos
quedan versionados junto a la spec y alimentan al Agente 1.

- **1.1 Modelo**: `sources.yaml` por spec (`specs/<id>/sources/manifest.yaml` + binarios en
  `specs/<id>/sources/files/`). Esquema zod: `id, filename, mime, kind (documento|datos|entrevista|otro),
  size, sha256, uploadedBy, uploadedAt, status (subido|ingerido|descartado), linkedStages[]`.
  Hecho cuando: esquema + store con tests (read/write/validación) en `packages/spec`.
- **1.2 API**: endpoints en el server del dashboard — `POST /api/specs/:id/sources` (multipart),
  `GET /api/specs/:id/sources`, `PATCH /api/specs/:id/sources/:sid` (kind/status/asociación),
  `DELETE` lógico (status `descartado`, nunca borra el binario — auditoría). Cada mutación escribe
  en el log de auditoría (`source.upload`, `source.update`, `source.discard`).
  Hecho cuando: curl de cada endpoint funciona y la auditoría registra actor/acción/timestamp.
- **1.3 Ingestión**: el runner de Descubrimiento usa `sources/files/` si el manifest tiene fuentes
  `subido|ingerido`; si no, cae a `samples/` (transición suave). Al correr, marca `ingerido`.
  Hecho cuando: `discover` corre end-to-end con un PDF y un CSV subidos por la UI, y la evidencia
  cita los archivos subidos.
- **1.4 UI**: página "Fuentes" (lista con badge de tipo, tamaño, estado, etapas asociadas) +
  **modal selector** reutilizable ("Seleccionar fuentes") con buscador y chips de filtro por tipo
  (Todos · Documentos · Datos · Entrevistas), patrón Stratify. Botón "Subir fuentes" con drag&drop.
  Hecho cuando: subir → ver en lista → seleccionar en modal → correr Descubrimiento desde la UI.

### W2 — Revisión humana granular (estados por hallazgo + comentarios)

**Resultado**: cada hallazgo tiene ciclo de vida visible y auditado; la compuerta respeta los estados.

- **2.1 Esquema**: en `finding`: `reviewStatus (pendiente|aprobado|rechazado|en_pausa)`,
  `reviewComment?`, `reviewedBy?`, `reviewedAt?`. Migración: los findings existentes quedan
  `pendiente` (o `aprobado` si ya pasaron compuerta — decidir y documentar).
  Hecho cuando: esquema + tests de store; specs existentes cargan sin romper.
- **2.2 API + auditoría**: `PATCH /api/specs/:id/findings/:fid/review` con
  `{status, comment, by}`. Reglas: `rechazado` y `en_pausa` exigen `comment` (400 si falta);
  verbos de auditoría `finding.approve|reject|pause|resume`. CLI espejo en el orquestador
  (`review <spec> <fid> --status --reason --by`).
  Hecho cuando: tests de reglas (comentario obligatorio) + entradas de auditoría correctas.
- **2.3 Verificación de compuerta**: nuevo criterio bloqueante — "Sin hallazgos pendientes ni en
  pausa de impacto alto" (los `medium/low` en pausa generan advertencia no bloqueante; documentar
  el umbral). "Iterar" en Definición acepta comentarios por ítem (JTBD/métrica) que se concatenan
  al feedback del agente.
  Hecho cuando: test del gate que bloquea con un high `en_pausa` y desbloquea al resolverlo.
- **2.4 UI de triage**: en cada tarjeta de hallazgo: grupo de acciones Aprobar / Rechazar /
  Pausar (las dos últimas abren **modal de comentario obligatorio**); badge de estado con color
  semántico (verde/rojo/ámbar/gris) y tooltip con comentario, revisor y fecha. Filtros por estado
  arriba del triage. Contadores en el header de etapa (ej. "10 hallazgos · 6 aprobados · 1 en pausa").
  Hecho cuando: ciclo completo desde la UI queda persistido en YAML y visible en Auditoría.

### W3 — Rediseño visual modular (piel clara tipo Stratify)

**Resultado**: misma información, jerarquía clara y aire. No es un rediseño de información, es de piel
y composición. **Antes de tocar componentes, leer la skill `frontend-design` del entorno si se
trabaja con Claude (define tokens y restricciones de estilo).**

- **3.1 Tokens**: tema claro como default (mantener el oscuro como toggle si es barato, si no,
  eliminarlo). Definir tokens en un solo archivo (CSS vars): superficie base gris-azulada muy clara,
  tarjetas blancas con radio generoso y sombra suave, 1 familia tipográfica, escala de 4–5 tamaños,
  acentos semánticos (real=verde, mock=ámbar, estados de revisión). Densidad: más padding, menos
  texto gris pequeño — la **evidencia anclada sube de jerarquía** (es el contenido que sustenta la
  confianza; hoy es lo más chico de la pantalla).
- **3.2 Layout de página**: cada etapa se compone de **tarjetas modulares** con header propio
  (icono + título + badge de tipo de contenido + contador), no un lienzo continuo. Breadcrumb
  persistente (`otp-onboarding / Definición / Compuerta`) para responder "¿dónde estoy?".
  El panel "Pipeline" del overview se vuelve clickeable (hoy dice "entrá a Definición" sin link).
- **3.3 Badges de tipo de contenido**: sistema único de chips — tipo de fuente (PDF/XLSX/CSV/TXT),
  tipo de evidencia (cálculo/cita), tipo de hallazgo (quantitative/qualitative), categoría HEART,
  estado de revisión, real/mock. Un solo componente Chip con variantes; eliminar estilos ad-hoc.
- **3.4 Microcorrecciones detectadas en la revisión en vivo**: (a) el resumen de auditoría del
  overview muestra entradas de iteraciones viejas que confunden ("6 métricas" vs 7 vigentes) —
  mostrar solo la última propuesta + link a "ver todo"; (b) leyenda real/mock visible en todas las
  vistas; (c) numeración y subtítulo de etapa ("Problema · se potencia") se mantienen.

### W4 — Superficies secundarias (paneles laterales y modales)

**Resultado**: el detalle profundo sale de la página principal y vive en superficies dedicadas.

- **4.1 Drawer de hallazgo** (panel lateral derecho): clic en un hallazgo abre el detalle completo —
  cadena evidencia → cálculo/cita → fuente con locator, historial de revisión, JTBD/métricas que lo
  citan (trazabilidad inversa). La tarjeta en el triage queda compacta.
- **4.2 Modales con propósito único**: (a) comentario de rechazo/pausa (W2.4); (b) selector de
  fuentes (W1.4); (c) confirmación de compuerta — resumen de lo que se aprueba (versión nueva,
  conteos, criterios) antes del commit. Regla: un modal = una decisión; lo exploratorio va al drawer.
- **4.3 Accesibilidad mínima**: foco atrapado en modales, cierre con Esc, navegación por teclado en
  el triage. (Coherencia: es una herramienta hecha por un equipo de UX.)

### W5 — Capa de usuario mockeada (sesión, perfil, configuración)

**Resultado**: la demo se siente como un producto con cuentas, sin construir autenticación real.
Todo etiquetado `mock` (invariante U-3), **excepto** la identidad del revisor, que sí es real.

- **5.1 Sesión mock**: pantalla de login estándar (email + contraseña, sin validación real; un
  "Entrar" que setea el usuario en `localStorage`). Usuario por defecto: Hugo (Lead PM), avatar,
  rol. Logout vuelve al login. Badge `mock` discreto en la pantalla de login.
- **5.2 Menú de cuenta**: avatar + nombre arriba del sidebar; al clic, popover con perfil
  (nombre, rol, editar), "Configuración" y "Cerrar sesión" — patrón del menú de usuario de
  Stratify (imagen 2).
- **5.3 Configuración (página mock)**: perfil (nombre, rol, avatar por iniciales o upload),
  apariencia (densidad), y placeholders honestos de lo que viene en Fase 5 (conectores, RBAC,
  miembros del equipo) con badge `mock` y referencia al PRD — convierte la página de settings en
  un mini-roadmap.
- **5.4 Identidad real en auditoría**: el usuario "logueado" alimenta `reviewedBy`, `uploadedBy` y
  el `--by` de las compuertas. Es la única parte no-mock de W5: cambia el nombre en el perfil y la
  próxima acción queda auditada con ese nombre. (Puente directo al RBAC real de Fase 5.)
  Hecho cuando: login → aprobar un hallazgo → la entrada de auditoría muestra al usuario de la sesión.

---

## 4. Guión de demo para stakeholders (validación final de la fase)

0. **Inicio sesión** como Lead PM y veo **"Mis specs"** agrupadas por producto; creo una spec nueva
   para el problema del día — 30 seg.
1. **Subo mis documentos** (PDF de entrevistas + CSV de funnel) en Fuentes — 30 seg.
2. **Corro Descubrimiento**: el agente extrae evidencia y deriva hallazgos, cada uno con su fuente
   citada — "la IA no inventa: todo apunta a tus archivos".
3. **Reviso como humano**: apruebo 7, rechazo 1 con motivo, pauso 1 "necesito validar con analítica" —
   los estados quedan visibles y auditados.
4. **La compuerta me frena**: no puedo avanzar con el hallazgo en pausa → lo resuelvo → avanzo.
5. **Definición**: JTBD y métricas ancladas a lo que yo aprobé; itero con un comentario puntual;
   apruebo la compuerta y la spec sube de versión con historial.
6. Cierre: pipeline de 7 etapas con lo real en verde y el plan en ámbar — roadmap honesto.

Criterio de éxito: la demo completa corre en <12 minutos sin tocar la terminal.

## 5. Secuencia de sesiones sugerida con Claude Code

| Sesión | Alcance | Verificación |
|---|---|---|
| 1 | W0.1 + W0.2 (índice de specs + API/CLI CRUD) | crear 2.ª spec por curl, índice regenerable |
| 2 | W0.3 + W0.4 (routing /spec/:id + "Mis specs" + switcher) | dos specs sin pisarse, crear desde UI |
| 3 | W1.1 + W1.2 (modelo + API de fuentes) | tests store + curl + auditoría |
| 4 | W1.3 + W1.4 (ingestión + UI fuentes) | discover E2E con archivos subidos |
| 5 | W2.1 + W2.2 (esquema estados + API/CLI) | tests reglas + auditoría |
| 6 | W2.3 + W2.4 (gate + UI triage) | gate bloquea/desbloquea desde UI |
| 7 | W3.1 + W3.2 (tokens + layout) | revisión visual conjunta |
| 8 | W3.3 + W3.4 + W4.1 (chips + drawer) | trazabilidad inversa en drawer |
| 9 | W4.2 + W4.3 (modales + accesibilidad) | ciclo de compuerta con confirmación |
| 10 | W5 completo + guión de demo | login→acción→auditoría con el usuario; ensayo <12 min |

Actualizar CLAUDE.md y ESTADO.md al cierre de cada sesión (alcance, decisiones, gotchas nuevos).

## 6. Riesgos y decisiones abiertas

- **Migración de findings existentes** (2.1): proponer `aprobado` para los que ya pasaron compuerta
  (están en la spec) y `pendiente` para los de propuestas vivas. Confirmar antes de codificar.
- **Tema claro vs oscuro**: recomendación = claro como único tema en la PoC (menos superficie de
  mantenimiento, alineado a la referencia visual). Confirmar.
- **Umbral de bloqueo del gate** (2.3): high bloquea, medium/low advierte. Confirmar.
- **Scope creep**: la tentación será dar estados por ítem también a JTBD/métricas. Resistir en esta
  fase (ver No-objetivos); si la demo lo pide, es una fase posterior.
- **Identificador de spec** (0.2): el id es inmutable una vez creado (es ruta en git y clave de
  auditoría); lo editable es el nombre. Validar kebab-case y unicidad al crear. Confirmar.
- **"Producto" como campo, no como entidad** (0.1): en esta fase producto es un string agrupador;
  un CRUD de productos con su propia página es Fase 5. Confirmar.
- **Login mock, identidad real** (W5): no implementar contraseñas ni sesiones de servidor — el
  riesgo es que parezca seguridad real sin serlo. El login es mock declarado; lo único real es que
  el nombre del usuario firma la auditoría. Confirmar que el equipo está cómodo con esa línea.
