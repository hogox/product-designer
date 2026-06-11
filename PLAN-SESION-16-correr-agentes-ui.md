# PLAN — Sesión 16: Correr agentes desde la UI (token-aware, sin doble corrida)

> Plan de ejecución para Claude Code. Complementa CLAUDE.md y el PRD; **no los reemplaza**.
> **Secuencia: esta sesión se ejecuta antes de F3-B (Agente 4).** Razón: cada agente nuevo
> que se agrega sin disparo en la UI agranda la brecha CLI↔UI; haciéndolo ahora, el Agente 4
> nace con su botón desde el día uno y el motor entero queda operable sin terminal.
> Metodología: planificar → confirmar → construir, en pasos chicos y verificables.
> Cada paso termina con `pnpm typecheck && pnpm -r test` en verde y un commit.

## 0. Motivación

Hoy los agentes solo se disparan por CLI (`node --env-file=.env … discover/define/explore`).
Eso **le quita valor al equipo**: un PM/diseñador no debería abrir una terminal, y un stakeholder
no puede operar el motor. El stakeholder ya tiene su flujo 100% en la UI (revisar propuesta,
triagear, aprobar/iterar en la compuerta); lo que falta es el **disparo de la corrida del agente**,
que es la acción del operador (PM/diseñador que maneja la spec).

El proyecto se construyó motor-primero con el CLI como cabina provisional del operador. Esta sesión
mueve esos disparos a la UI — que es la **cabina de producción** del PRD §14.

## 1. Alcance (decidido)

- **Los 3 agentes**: Descubrimiento, Definición y Exploración disparables desde la UI.
- **Contabilidad de tokens completa**: el `usage` real de cada llamada (in/out/total) se threadea
  hasta la UI y la auditoría — no solo el ahorro por cache.

## 2. Principios (requisitos de primera clase)

- **La `ANTHROPIC_API_KEY` vive solo en el server.** El browser dispara y observa; nunca ve la key.
- **Nunca re-correr un agente sin confirmación explícita.** Si ya hay artefacto de una corrida previa,
  el botón abre un Dialog que muestra qué se sobreescribe, qué triage se pierde y el costo estimado.
- **No gastar tokens al pedo.** El cache de evidencia por sha256 (O1·P3) es el ahorro estructural:
  re-extraer una fuente sin cambios = 0 tokens. El plan lo *surface* (preflight + cache hits), no lo
  reinventa. Una corrida sin cambios se desalienta explícitamente.
- **Toda corrida es una acción auditada con costo.** Se registra quién la disparó y cuántos tokens costó.

## 3. Decisiones de diseño

- **D1 — Ejecución async con lock.** La corrida NO es una request HTTP larga (timeouts, sin progreso).
  Es un *job* en el proceso del server: `POST …/run/:agent` arranca y devuelve `{jobId, status}`; la
  UI *poll*ea `GET …/run/:agent`. **Lock por (specId, agente)**: un segundo disparo mientras corre →
  `409 "ya hay una corrida en curso"`. Esto mata la doble corrida accidental y la race sobre los
  archivos del store. Registro de jobs en memoria (un job activo por spec+agente basta hoy).
- **D2 — "Ya corrió" se detecta por artefacto.** discover → existe `findings.yaml`; define → existe
  `spec.proposed.yaml`; explore → existe `concepts.yaml` con conceptos. Reusa lo que `getState` ya
  computa (findings/hasProposal/concepts). Si ya corrió → Dialog de confirmación ANTES de gastar.
  Sin artefacto previo → corre directo (con un toast de "corriendo…").
- **D3 — Preflight de costo (corazón del ahorro).** `GET …/discover/preflight` compara los sha256 de
  las fuentes vs. el cache de evidencia y devuelve `{fuentes, enCache, aExtraer, yaHayHallazgos}`. El
  Dialog muestra: *"K de N fuentes se re-extraen; M ya en cache (0 tokens); 1 derivación."* Si todo
  está en cache y nada cambió → advertencia *"nada cambió desde la última corrida; re-correr solo
  re-deriva (los hallazgos pueden variar levemente)"*. (Definición/Exploración no tienen cache de
  extracción → su preflight informa "1 llamada al modelo, ~X tokens estimados" sin el desglose de cache.)
- **D4 — Contabilidad real de tokens (completa).** `callStructured` ya devuelve `usage`; hoy se
  descarta. Se threadea: proposer (extract/derive/define/explore) → runner → stage → endpoint → UI.
  Cada corrida acumula `{ input, output, total, cacheHits }` y:
  - la UI lo muestra tras terminar: *"costó 3.4k tokens (in 2.1k / out 1.3k) · 3/3 fuentes en cache"*.
  - la auditoría `agent.proposed` gana el costo en su `reason` (o un campo nuevo, según el esquema de
    audit lo permita sin romper).
- **D5 — Rol "operador" (gancho a RBAC).** Disparar una corrida (acción con costo) se marca como rol
  `operador`, distinto de aprobar una compuerta. Hoy `useSession().user` es Lead PM y todos son
  operadores; el gancho (un check `canRunAgents(user)` que hoy devuelve true) queda listo para el RBAC
  real de Fase 5. El stakeholder que solo revisa/aprueba no necesita este permiso.
- **D6 — explore re-corre distinto (P3).** Por el merge no destructivo, explore conserva los conceptos
  triados y agrega propuestos; el mensaje de confirmación lo refleja ("se conservan los seleccionados
  y descartados; se generan N conceptos nuevos"), no "se sobreescribe todo". discover/define sí
  sobreescriben su working set, y el Dialog lo dice.

## 4. Pasos

### P1 — Infra de ejecución (server)
Registro de jobs en memoria (`Map<key, Job>`, key = `${specId}:${agent}`) + lock. Wrapper
`runAgentJob(specId, agent, fn)` que setea `running`, corre, captura resultado/error/tokens y deja
`done|error`. Endpoints genéricos:
- `POST /api/specs/:id/run/:agent` → arranca; `409` si ya hay job activo; `400` si precondición del
  agente falla (p.ej. explore con propuesta pendiente).
- `GET /api/specs/:id/run/:agent` → `{ status: idle|running|done|error, result?, error?, tokens? }`.
Sin tocar los runners todavía (los llama tal cual hoy).
**Hecho cuando:** test del lock (segundo POST → 409) y del ciclo idle→running→done.

### P2 — Guarda de doble corrida + preflight
`GET /api/specs/:id/discover/preflight` (cache-aware vía `computeFileSha256` + `readEvidenceCache`).
Para define/explore, un preflight liviano que informa "1 llamada al modelo" + si ya hay artefacto.
UI: el disparo, si `getState` indica artefacto previo, abre `RunConfirmDialog` con el costo estimado
y qué se pierde; si no, corre directo. Lógica "nada cambió" para discover.
**Hecho cuando:** test del preflight (N fuentes, M en cache, K a extraer); la guarda no deja re-correr
sin pasar por el Dialog.

### P3 — Contabilidad de tokens (completa)
Threadear `usage` desde `callStructured` por los 4 proposers → runners → `runDiscovery/runDefinition/
runExploration` (devuelven `{..., tokens}`) → `runAgentJob` → endpoint. Registrar el costo en la
auditoría. UI muestra el costo real al terminar.
**Hecho cuando:** tests de que el usage se propaga (stub que devuelve usage conocido → el resultado del
job lo refleja); el audit registra el costo.

### P4 — UI de Descubrimiento (botón + estados)
Botón "Correr Descubrimiento" en la página de Fuentes (o un panel nuevo en la etapa Descubrimiento),
con estados corriendo (spinner + polling)/listo (toast + costo + link al triage)/error (mensaje). El
empty state de `FindingsTriage` reemplaza el hint `orchestrator discover` por el botón.
**Hecho cuando:** verificado live — disparar discover en una spec nueva genera hallazgos, muestra el
costo, y el triage se puebla; re-correr abre el Dialog.

### P5 — Definición + Exploración (mismo patrón)
Botones para Definición (cerca de la compuerta/etapa) y Exploración (en la sección Conceptos), reusando
la infra de P1-P3. Define respeta su precondición (hay hallazgos); explore respeta las suyas (approved +
JTBD + sin propuesta pendiente) y su mensaje de re-corrida es el del merge (D6).
**Hecho cuando:** verificado live — define genera propuesta y explore genera conceptos desde la UI, ambos
con costo visible y guarda de re-corrida.

### P6 — Rol operador + tests + docs
`canRunAgents(user)` (hoy `true`) como gancho RBAC-lite, aplicado a los botones de disparo. Suite de
tests del lock/preflight/guarda/tokens. Actualizar ESTADO.md (sesión 16 + gotchas) y CLAUDE.md.
**Hecho cuando:** `pnpm -r test` verde; docs al día.

## 5. No-objetivos
- **No** streaming token-por-token (el polling de estado alcanza; SSE es upgrade futuro).
- **No** RBAC real ni multiusuario (solo el gancho `canRunAgents`; Fase 5).
- **No** cuotas/límites de tokens por usuario ni cola de jobs entre specs (un job por spec+agente basta).
- **No** persistir los jobs entre reinicios del server (registro en memoria; si el server reinicia
  durante una corrida, el job se pierde y se vuelve a disparar — la corrida es idempotente sobre el store).

## 6. Criterio de salida
Un PM/diseñador crea una spec, sube fuentes, y dispara **Descubrimiento → Definición → Exploración
desde la UI**, viendo el costo estimado antes (preflight) y el real después (tokens), sin abrir una
terminal. Re-correr cualquier agente exige confirmación y aprovecha el cache (re-extracción 0 tokens en
fuentes sin cambios). Dos disparos simultáneos del mismo agente se bloquean (409). El stakeholder sigue
operando solo en la UI (revisar/aprobar), sin tocar nunca un comando.
