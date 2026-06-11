# PLAN — Sesión 15c: Cierre de la etapa Exploración (gaps pre-Agente 4)

> Plan de ejecución para Claude Code. Complementa CLAUDE.md y el PRD; **no los reemplaza**.
> **Secuencia: esta sesión se ejecuta COMPLETA antes de iniciar F3-B (Agente 4 — Diseño).**
> Razón: el Agente 4 necesita una entrada estable y versionada ("estos N conceptos seleccionados,
> de la spec vN") que hoy no existe — los conceptos viven en un archivo de trabajo mutable que el
> propio agente puede pisar. Construir A4 sobre eso obliga a migrarlo después.
> Metodología: planificar → confirmar → construir, en pasos chicos y verificables.
> Cada paso termina con `pnpm typecheck && pnpm -r test` en verde y un commit.

## 0. Contexto: qué encontró la auditoría (2026-06-11)

F3-A (Agente 3 — Exploración) quedó funcional pero **sin cierre de etapa**:

1. **`current_stage` nunca llega a "exploracion"**: solo escriben la etapa `createSpecV0`
   ("descubrimiento"), el Agente 2 ("definicion") y `approveGate`, que la **hardcodea** a
   `"definicion"` (`stage.ts:338`). `runExploration` no toca `spec.yaml`.
2. **Re-correr `explore` destruye el triage humano**: `writeConcepts` reemplaza el archivo entero
   y `assembleConcepts` recicla ids desde `C-001` — los `seleccionado` se pierden y el audit queda
   apuntando a conceptos distintos. Choca con la invariante 2.
3. **No hay cierre formal**: ni `explorationVerification`, ni promoción de seleccionados a
   `spec.concepts` (el campo existe en el esquema pero está vacío en toda spec real; `approveGate`
   ignora `concepts.yaml`), ni precondición computable para A4 (`getState` no lee conceptos).
4. **Estado incoherente real**: `otp-onboarding` tiene una propuesta de Definición `in_review`
   colgada (09-06) Y conceptos generados encima (11-06). `runExploration` no chequea `hasProposal`;
   los conceptos no sellan contra qué versión de spec nacieron.
5. **`TOPIC` hardcodeado** a OTP en `cli.ts:36` — `discover`/`define`/`explore` lo usan para
   cualquier spec.
6. **El explorador ignora intake, constraints y scope** — el prompt dice "no inventes restricciones
   no mencionadas" sin mencionarle ninguna.
7. **Feedback de `gate.iterate` contaminado**: `runDefinition` busca el último `gate.iterate`
   posterior al último `agent.proposed`, pero el Agente 3 también emite `agent.proposed` →
   la secuencia define → iterate → explore → define pierde el feedback.
8. Menores: `status` CLI ciego a conceptos; Overview/StatCards sin conceptos; texto desactualizado
   en `StagePlaceholder`; selección sin `Decision`; `@pda/llm` sin tests; identidad git sin config.

## 1. Decisiones de diseño (cerradas en este plan)

- **D1 — Quién avanza la etapa.** `runExploration` escribe `current_stage: "exploracion"` en su
  primer run (ya audita `stage.start` y commitea; el write es coherente con ese evento).
  `approveGate` deja de hardcodear `"definicion"`: hereda `proposed.current_stage` (el agente que
  propuso ya la seteó) — generaliza para compuertas futuras.
- **D2 — El cierre de Exploración es una acción humana explícita, NO una compuerta.** El PRD §6 es
  taxativo: las compuertas son 3 (enmarcar/curar/responder) y "curar" cierra Validación, no
  Exploración. Por eso `closeExploration` **no sube versión** (las versiones las suben las
  compuertas) pero sí: exige rationale humano (invariante 7), promueve los `seleccionado` a
  `spec.concepts`, registra UNA entrada en `spec.decisions` (la selección de conceptos ES la
  decisión-con-rationale que ese campo pide), setea `current_stage: "diseno"`, limpia
  `concepts.yaml` (espejo del patrón findings→`approveGate`) y audita + commitea.
- **D3 — Re-explore = merge, no replace.** Se conservan intactos los conceptos `seleccionado` y
  `descartado`; solo se reemplazan los `propuesto`. Los ids nuevos continúan desde el máximo
  existente (nunca se recicla un id ya emitido — el audit es append-only y apunta por id).
- **D4 — Sellado de procedencia.** Cada concepto gana `spec_version` (opcional, default `null`
  para compat con los YAML existentes), estampado por el orquestador al ensamblar. Un concepto
  declara contra qué versión de JTBD nació.
- **D5 — Propuesta colgada = acción nueva `discard-proposal`.** No existe forma auditada de
  descartar una propuesta pendiente (solo aprobar o iterar). Se agrega `discardProposal` (exige
  motivo — invariante 7; verbo `proposal.discard`; borra `spec.proposed.yaml`; commitea) y se usa
  para sanear `otp-onboarding`.
- **D6 — El grounding del explorador NO viola la invariante 3.** La invariante prohíbe sesgar la
  **extracción de evidencia**; en Exploración no hay extracción — los conceptos son síntesis
  creativa sobre JTBD ya validados. `productContext`, `hypotheses`, `constraints` y `non_goals`
  SÍ entran al prompt (es exactamente la información que evita conceptos fuera de alcance).

## 2. No-objetivos (para contener el alcance)

- **No se construye el Agente 4** ni nada de la etapa Diseño (eso es F3-B, después de esto).
- **No se implementa el gate "curar"** (llega con Validación, F3-C) ni control de acceso.
- **No "correr agentes desde la UI"**: sigue diferido consciente (requiere mover credenciales y
  llamadas al modelo al server + manejo de progreso). Se decidirá como sesión propia; cada agente
  nuevo agranda la brecha CLI/UI, así que conviene resolverlo antes de F3-C.
- **No hay drawer de detalle para conceptos** (paridad con FindingDrawer): se evalúa cuando el
  Agente 4 defina qué trazabilidad necesita mostrar (concepto → diseños).
- No se toca el esquema de findings/JTBD/métricas ni el flujo de Definición (salvo el fix del
  feedback contaminado, P5).

## 3. Pasos (orden de dependencia)

### P0 — Topic desde la spec (mata el hardcode)

`resolveTopic(spec)` en el orquestador: `intake.researchQuestion ?? spec.title`. Se elimina la
constante `TOPIC` de `cli.ts`; `discover`, `define` y `explore` derivan el topic de la spec que
están procesando. El server del dashboard no cambia (no corre agentes).

**Hecho cuando:** no queda ninguna referencia a la constante; un test cubre la cadena de
resolución (con intake → researchQuestion; sin intake → title).

### P1 — Coherencia de estado + sellado de versión

1. `ConceptSchema += spec_version` (nullable, default null). `runExploration` estampa
   `current.version` en cada concepto nuevo al persistir.
2. `runExploration` **falla** si existe `spec.proposed.yaml` (mensaje: "hay una propuesta de
   Definición pendiente; aprobala o descartala antes de explorar").
3. `discardProposal(rootDir, specId, {reason, by})`: exige motivo, borra `spec.proposed.yaml`,
   audita `proposal.discard`, commitea. CLI `discard-proposal <spec> --reason [--by]`.
4. **Saneamiento de `otp-onboarding`** (con esto ya construido): descartar la propuesta colgada
   del 09-06 vía `discard-proposal` (motivo: artefacto de demo previo a F3-A; los conceptos
   existentes citan los JTBD de v3 vigente). Re-estampar `spec_version: 3` en los 5 conceptos
   existentes (edición one-off auditada).

**Hecho cuando:** tests de la precondición y de `discardProposal`; `otp-onboarding` queda sin
propuesta colgada y con conceptos sellados; `pnpm -r test` verde.

### P2 — Transición de etapa (D1)

1. `runExploration`: si `current.current_stage !== "exploracion"`, escribe la spec con
   `current_stage: "exploracion"` (mismo commit que ya hace).
2. `approveGate`: `current_stage: proposed.current_stage` (y la entrada de history usa la misma) —
   muere el hardcode.
3. Verificar que el índice (`specs/index.yaml`) y el sidebar del dashboard reflejan la etapa nueva
   (derivan de `current_stage`; no debería requerir cambios, solo verificación).

**Hecho cuando:** test "runExploration transiciona la etapa (y es idempotente al re-correr)";
test de approveGate sin hardcode; el sidebar marca Exploración como etapa actual en el preview.

### P3 — Re-explore no destructivo (D3)

1. `assembleConcepts(jobs, raws, opts?: { firstId?: number })` — los ids arrancan donde se le
   indique (default 1; el contrato actual no cambia).
2. `runExploration`: merge — `kept = existentes con review_status !== "propuesto"`;
   `firstId = maxId(existentes) + 1`; persiste `[...kept, ...nuevos]`. El feedback de descartados
   (ya implementado) sigue saliendo de los `descartado` conservados.

**Hecho cuando:** tests — re-explore conserva seleccionados/descartados intactos, reemplaza solo
propuestos, y jamás reusa un id emitido (aunque el concepto que lo llevaba haya sido reemplazado).

### P4 — Cierre formal de Exploración (D2) — la entrada del Agente 4

1. `explorationVerification(concepts)` en `verify.ts`, 3 criterios bloqueantes:
   "≥1 concepto seleccionado", "0 conceptos en `propuesto` (triage completo)",
   "todo seleccionado cita JTBD existentes en la spec vigente".
2. `closeExploration(rootDir, specId, {by, rationale})`: corre la verificación (falla si no pasa);
   promueve los `seleccionado` a `spec.concepts`; agrega `Decision` (id `DEC-NNN`, decision =
   "Selección de conceptos: C-00X, C-00Y", rationale = el del humano, author = by); setea
   `current_stage: "diseno"`; borra `concepts.yaml`; audita `exploration.close`; commitea.
   **No sube versión** (D2).
3. CLI `close-exploration <spec> --rationale "..." [--by "..."]`.
4. Server: `POST /api/specs/:id/exploration/close {rationale, by}` +
   `GET /api/specs/:id/exploration/verification`.
5. UI: panel "Cerrar Exploración" al pie de la sección Conceptos (patrón del panel de compuerta:
   lista de criterios pass/fail + botón primario habilitado solo si la verificación pasa + Dialog
   de confirmación con campo rationale obligatorio). Tras cerrar, la sección muestra los conceptos
   promovidos en modo lectura ("Exploración cerrada — conceptos en la spec") y el Overview los
   lista en la Spec viva.

**Hecho cuando:** tests de verificación y de `closeExploration` (promoción + Decision + etapa +
limpieza + bloqueo si hay propuestos); flujo completo verificado en el preview con
`otp-onboarding` (triage de los 4 propuestos restantes → cerrar → spec con concepts + decision).

### P5 — Grounding del explorador (D6) + fix del feedback contaminado

1. `ConceptProposer.propose` gana entrada opcional `context?: { productContext?, hypotheses?,
   constraints?, nonGoals? }`; el prompt los inyecta como bloques (mismo patrón que el grounding
   de derivación). `createExplorationRunner` los arma desde `spec.intake`, `spec.constraints` y
   `spec.scope.non_goals`.
2. Fix P4-O1: la búsqueda del feedback en `runDefinition` filtra los `agent.proposed` por actor
   del Agente 2 (hoy un `agent.proposed` de Exploración tapa el feedback de Definición).

**Hecho cuando:** test del passthrough de contexto (stub captura los bloques); test del feedback
con un `agent.proposed` de agent3 intercalado (el feedback de Definición sobrevive).

### P6 — Visibilidad de la etapa

1. `StageState += { concepts: number; conceptsSelected: number }` (lee `concepts.yaml` y/o
   `spec.concepts`); `status` del CLI los imprime.
2. Dashboard: stat-card "Conceptos" en el Overview (total + seleccionados, visible cuando > 0);
   la Spec viva lista `spec.concepts` cuando existen (post-cierre).
3. `StagePlaceholder`: texto actualizado ("reales: Descubrimiento, Definición y Exploración" —
   o mejor, derivarlo de `STAGES.filter(s => s.real)` para que no vuelva a quedar viejo).

**Hecho cuando:** `status` refleja conceptos; Overview con stat-card verificada en preview;
el texto del placeholder se deriva de los datos (no vuelve a hardcodearse).

### P7 — Higiene

1. Tests de `@pda/llm` (hoy 0): `resolveModel` (cadena completa de overrides) y `callStructured`
   con cliente inyectado (parse ok, fallback `{}` ante JSON inválido, `thinking` omitido para
   modelos Haiku, logging de tokens).
2. Identidad git del repo: `git config` local (`user.name` / `user.email`) para matar el warning
   de committer en cada commit del store.
3. Documentación: actualizar ESTADO.md (sección de sesión + gotchas nuevos: D2/D3/D5) y CLAUDE.md
   (estado F3-A "cerrada de verdad", próxima F3-B).

**Hecho cuando:** `pnpm -r test` verde con los tests nuevos de llm; un commit sin warning de
identidad; docs al día.

## 4. Criterio de salida de la sesión

El Agente 4 puede nacer leyendo `spec.concepts` (entrada versionada, sellada y estable) en una
spec cuya etapa dice la verdad (`current_stage: "diseno"`), con un flujo Exploración re-corrible
sin destruir triage humano, sin estados incoherentes posibles (propuesta colgada + explore), y
con el topic/grounding derivados de la spec real — todo verificado por tests offline + un pase
live en el preview con `otp-onboarding`.
