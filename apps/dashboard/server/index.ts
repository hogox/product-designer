// Server del dashboard: lee el almacén de spec y orquesta las corridas de agente disparadas
// desde la UI (Sesión 16). La ANTHROPIC_API_KEY vive SOLO acá (cargada vía --env-file); el
// browser dispara y observa, nunca ve la key. Las corridas son jobs async con lock por
// (spec, agente) — ver agentJobs.ts.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import multer from "multer";
import {
  readAudit,
  readSpec,
  readProposedSpec,
  readFindings,
  readConcepts,
  readSpecGroups,
  regenerateIndex,
  createSpec,
  updateSpecMeta,
  archiveSpec,
  readSources,
  addSource,
  updateSource,
  discardSource,
  updateIntake,
  computeSourceCompleteness,
  StageSchema,
  type SourceKind,
  type SourceStatus,
  type Stage,
} from "@pda/spec";
import {
  getState,
  approveGate,
  rejectFinding,
  reviewFinding,
  iterateGate,
  reviewConcept,
  closeExploration,
  explorationVerification,
  resolveTopic,
  runDiscoveryWithSources,
  createDefinitionRunner,
  createExplorationRunner,
  runDefinition,
  runExploration,
  discoverPreflight,
} from "@pda/orchestrator";

import {
  startAgentJob,
  getJob,
  jobView,
  isAgentName,
  JobConflictError,
  type AgentName,
  type AgentRunSummary,
  type TokenUsage,
} from "./agentJobs.ts";

const REVIEW_STATUSES = [
  "pendiente",
  "aprobado",
  "rechazado",
  "en_pausa",
] as const;
type ReviewStatusLiteral = (typeof REVIEW_STATUSES)[number];

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SPECS_DIR = resolve(REPO_ROOT, "specs");
const PORT = Number(process.env.DASH_PORT ?? 8791);

// Pipeline de 7 etapas (PRD §6). En Fase 0 TODO está mockeado (real:false).
// En Fase 1 se vuelven reales Descubrimiento/Definición y la compuerta "enmarcar".
const PIPELINE = [
  {
    n: 1,
    id: "descubrimiento",
    name: "Descubrimiento",
    diamante: "Problema",
    modo: "se potencia",
    gate: null,
    status: "real",
    real: true,
  },
  {
    n: 2,
    id: "definicion",
    name: "Definición (pasada ligera)",
    diamante: "Problema",
    modo: "se potencia",
    gate: "enmarcar",
    status: "real",
    real: true,
  },
  {
    n: 3,
    id: "exploracion",
    name: "Exploración",
    diamante: "Solución",
    modo: "se reduce",
    gate: null,
    status: "real",
    real: true,
  },
  {
    n: 4,
    id: "diseno",
    name: "Diseño",
    diamante: "Solución",
    modo: "se reduce + automatizable",
    gate: null,
    status: "mock",
    real: false,
  },
  {
    n: 5,
    id: "validacion",
    name: "Validación",
    diamante: "Solución",
    modo: "mixto",
    gate: "curar",
    status: "mock",
    real: false,
  },
  {
    n: 6,
    id: "entrega",
    name: "Entrega",
    diamante: "Entrega",
    modo: "automatizable",
    gate: null,
    status: "mock",
    real: false,
  },
  {
    n: 7,
    id: "aprendizaje",
    name: "Aprendizaje",
    diamante: "Entrega",
    modo: "se potencia",
    gate: "responder",
    status: "mock",
    real: false,
  },
] as const;

const app = express();
app.use(express.json());

// Fuentes (D2 · W1): subida multipart en memoria; el binario lo persiste el store.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB por archivo
});

const SOURCE_KINDS: SourceKind[] = [
  "documento",
  "datos",
  "entrevista",
  "persona",
  "otro",
];
const SOURCE_STATUSES: SourceStatus[] = ["subido", "ingerido", "descartado"];

// --- gestión multi-spec (D2 · W0): índice agrupado por producto + CRUD ---

// lista de specs agrupadas por producto. El índice es cache regenerable y las acciones del
// orquestador (close-exploration, discard-proposal, explore…) NO lo regeneran — así que el
// home lo refresca aquí (escaneo del filesystem, barato) para no mostrar etapa/propuesta viejas.
app.get("/api/specs", async (_req, res) => {
  try {
    await regenerateIndex(REPO_ROOT);
    res.json(await readSpecGroups(REPO_ROOT));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// crear spec: id kebab-case (derivado del name si se omite), inmutable y único
app.post("/api/specs", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const product = String(req.body?.product ?? "").trim();
  const id = req.body?.id ? String(req.body.id).trim() : undefined;
  const description =
    req.body?.description != null ? String(req.body.description) : null;
  const actor = String(req.body?.by ?? "human").trim() || "human";
  if (!name) return res.status(400).json({ error: "falta el nombre (name)" });
  if (!product)
    return res.status(400).json({ error: "falta el producto (product)" });
  try {
    const entry = await createSpec(
      REPO_ROOT,
      { id, name, product, description },
      actor,
    );
    res.status(201).json(entry);
  } catch (err) {
    // id inválido / duplicado / nombre faltante → error de cliente
    res.status(400).json({ error: String(err) });
  }
});

// editar metadatos mutables (name/product/description); el id es inmutable
app.patch("/api/specs/:id", async (req, res) => {
  const actor = String(req.body?.by ?? "human").trim() || "human";
  const patch: {
    name?: string;
    product?: string;
    description?: string | null;
  } = {};
  if (req.body?.name !== undefined) patch.name = String(req.body.name);
  if (req.body?.product !== undefined) patch.product = String(req.body.product);
  if (req.body?.description !== undefined)
    patch.description =
      req.body.description === null ? null : String(req.body.description);
  try {
    const entry = await updateSpecMeta(REPO_ROOT, req.params.id, patch, actor);
    res.json(entry);
  } catch (err) {
    res
      .status(404)
      .json({ error: `spec no encontrada o inválida: ${String(err)}` });
  }
});

// archivar = soft delete (status archivada); exige motivo, nunca borra el directorio
app.post("/api/specs/:id/archive", async (req, res) => {
  const reason = String(req.body?.reason ?? "").trim();
  const actor = String(req.body?.by ?? "human").trim() || "human";
  if (!reason)
    return res.status(400).json({ error: "falta el motivo del archivado" });
  try {
    const entry = await archiveSpec(REPO_ROOT, req.params.id, {
      reason,
      actor,
    });
    res.json(entry);
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

// regenerar el índice manualmente (cache); útil para diagnóstico
app.post("/api/specs/reindex", async (_req, res) => {
  try {
    res.json(await regenerateIndex(REPO_ROOT));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- intake (D2 · W6): enmarcado del discovery ---

// setear/reemplazar el intake de la spec (researchQuestion + plan). Audita intake.update.
app.patch("/api/specs/:id/intake", async (req, res) => {
  const { by: _by, ...intake } = req.body ?? {};
  const actor = String(req.body?.by ?? "human").trim() || "human";
  try {
    const next = await updateIntake(REPO_ROOT, req.params.id, intake, actor);
    res.json(next.intake);
  } catch (err) {
    // researchQuestion faltante / enum inválido → 400; spec inexistente → cae acá también
    res.status(400).json({ error: String(err) });
  }
});

// --- hub de Fuentes (D2 · W1): documentación que alimenta al Agente 1 ---

// listar fuentes de una spec
app.get("/api/specs/:id/sources", async (req, res) => {
  try {
    res.json(await readSources(REPO_ROOT, req.params.id));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// completitud de fuentes (W6.2b): tipos esperados (del plan) vs. subidos
app.get("/api/specs/:id/sources/completeness", async (req, res) => {
  try {
    res.json(await computeSourceCompleteness(REPO_ROOT, req.params.id));
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

// subir una fuente (multipart, campo "file"; opcional kind, by)
app.post(
  "/api/specs/:id/sources",
  upload.single("file"),
  async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "falta el archivo (file)" });
    const actor = String(req.body?.by ?? "human").trim() || "human";
    const rawKind = req.body?.kind ? String(req.body.kind) : undefined;
    if (rawKind && !SOURCE_KINDS.includes(rawKind as SourceKind))
      return res.status(400).json({ error: `kind inválido: ${rawKind}` });
    try {
      await readSpec(REPO_ROOT, req.params.id); // 404 si la spec no existe
      const entry = await addSource(
        REPO_ROOT,
        req.params.id,
        {
          filename: file.originalname,
          mime: file.mimetype,
          bytes: file.buffer,
          uploadedBy: actor,
          kind: rawKind as SourceKind | undefined,
        },
        actor,
      );
      res.status(201).json(entry);
    } catch (err) {
      res
        .status(404)
        .json({ error: `spec no encontrada o fuente inválida: ${String(err)}` });
    }
  },
);

// editar metadatos de una fuente (kind/status/linkedStages)
app.patch("/api/specs/:id/sources/:sid", async (req, res) => {
  const actor = String(req.body?.by ?? "human").trim() || "human";
  const patch: {
    kind?: SourceKind;
    status?: SourceStatus;
    linkedStages?: Stage[];
  } = {};
  if (req.body?.kind !== undefined) {
    if (!SOURCE_KINDS.includes(req.body.kind))
      return res.status(400).json({ error: `kind inválido: ${req.body.kind}` });
    patch.kind = req.body.kind;
  }
  if (req.body?.status !== undefined) {
    if (!SOURCE_STATUSES.includes(req.body.status))
      return res
        .status(400)
        .json({ error: `status inválido: ${req.body.status}` });
    patch.status = req.body.status;
  }
  if (req.body?.linkedStages !== undefined) {
    const parsed = StageSchema.array().safeParse(req.body.linkedStages);
    if (!parsed.success)
      return res.status(400).json({ error: "linkedStages inválido" });
    patch.linkedStages = parsed.data;
  }
  try {
    const entry = await updateSource(
      REPO_ROOT,
      req.params.id,
      req.params.sid,
      patch,
      actor,
    );
    res.json(entry);
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

// descartar una fuente (DELETE lógico → status descartado; nunca borra el binario)
app.delete("/api/specs/:id/sources/:sid", async (req, res) => {
  const actor = String(req.body?.by ?? "human").trim() || "human";
  const reason = req.body?.reason ? String(req.body.reason) : undefined;
  try {
    const entry = await discardSource(REPO_ROOT, req.params.id, req.params.sid, {
      actor,
      reason,
    });
    res.json(entry);
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

app.get("/api/spec/:id", async (req, res) => {
  try {
    res.json(await readSpec(REPO_ROOT, req.params.id));
  } catch (err) {
    res
      .status(404)
      .json({ error: `spec no encontrada o inválida: ${String(err)}` });
  }
});

app.get("/api/audit/:id", async (req, res) => {
  try {
    res.json(await readAudit(REPO_ROOT, req.params.id));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/pipeline", (_req, res) => {
  res.json(PIPELINE);
});

// estado de la etapa (versión, propuesta pendiente, nº de findings)
app.get("/api/state/:id", async (req, res) => {
  try {
    res.json(await getState(REPO_ROOT, req.params.id));
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

// hallazgos en el store (para el triage tras Descubrimiento, antes de la propuesta)
app.get("/api/findings/:id", async (req, res) => {
  try {
    res.json(await readFindings(REPO_ROOT, req.params.id));
  } catch {
    res.json([]);
  }
});

// propuesta pendiente (null si no hay)
app.get("/api/proposed/:id", async (req, res) => {
  try {
    res.json(await readProposedSpec(REPO_ROOT, req.params.id));
  } catch {
    res.json(null);
  }
});

// --- compuertas humanas (el agente propone, el humano aprueba) ---

// micro-validación: rechazar un hallazgo con motivo (invariante 7)
app.post("/api/findings/:id/:fid/reject", async (req, res) => {
  const reason = String(req.body?.reason ?? "").trim();
  const actor = String(req.body?.actor ?? "human");
  if (!reason)
    return res.status(400).json({ error: "falta el motivo del rechazo" });
  try {
    const updated = await rejectFinding(
      REPO_ROOT,
      req.params.id,
      req.params.fid,
      {
        reason,
        actor,
      },
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// revisión humana por hallazgo (W2): aprobar / rechazar / pausar / pendiente
// rechazado y en_pausa exigen comentario (400 si falta).
app.patch("/api/specs/:id/findings/:fid/review", async (req, res) => {
  const status = String(req.body?.status ?? "");
  const comment =
    req.body?.comment != null ? String(req.body.comment) : undefined;
  const actor = String(req.body?.by ?? "human").trim() || "human";
  if (!REVIEW_STATUSES.includes(status as ReviewStatusLiteral))
    return res.status(400).json({ error: `status inválido: ${status}` });
  try {
    const finding = await reviewFinding(
      REPO_ROOT,
      req.params.id,
      req.params.fid,
      { status: status as ReviewStatusLiteral, comment, actor },
    );
    res.json(finding);
  } catch (err) {
    // comentario faltante (rechazado/en_pausa) o hallazgo inexistente
    res.status(400).json({ error: String(err) });
  }
});

// compuerta enmarcar — APROBAR (sube versión + commit + history)
app.post("/api/gate/:id/approve", async (req, res) => {
  const approver = String(req.body?.approver ?? "").trim();
  if (!approver) return res.status(400).json({ error: "falta el aprobador" });
  try {
    const next = await approveGate(REPO_ROOT, req.params.id, {
      approver,
      author: { name: approver, email: "gate@pda.local" },
    });
    res.json(next);
  } catch (err) {
    res.status(409).json({ error: String(err) });
  }
});

// compuerta enmarcar — ITERAR (registra feedback)
app.post("/api/gate/:id/iterate", async (req, res) => {
  const feedback = String(req.body?.feedback ?? "").trim();
  const actor = String(req.body?.actor ?? "human");
  if (!feedback) return res.status(400).json({ error: "falta el feedback" });
  try {
    await iterateGate(REPO_ROOT, req.params.id, { feedback, actor });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- conceptos de solución (Exploración, F3-A) ---

// listar conceptos de trabajo de la spec (concepts.yaml)
app.get("/api/specs/:id/concepts", async (req, res) => {
  try {
    res.json(await readConcepts(REPO_ROOT, req.params.id));
  } catch {
    res.json([]);
  }
});

// triage de un concepto: seleccionar / descartar / reabrir
// PATCH /api/specs/:id/concepts/:cid/review  { status, note?, by? }
app.patch("/api/specs/:id/concepts/:cid/review", async (req, res) => {
  const status = String(req.body?.status ?? "");
  const validStatuses = ["seleccionado", "descartado", "propuesto"];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: `status inválido: ${status}` });
  const note =
    req.body?.note != null ? String(req.body.note) : undefined;
  const actor = String(req.body?.by ?? "human").trim() || "human";
  try {
    const concept = await reviewConcept(
      REPO_ROOT,
      req.params.id,
      req.params.cid,
      {
        status: status as "seleccionado" | "descartado" | "propuesto",
        note,
        actor,
      },
    );
    res.json(concept);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// verificación de cierre de Exploración (¿se puede cerrar?)
app.get("/api/specs/:id/exploration/verification", async (req, res) => {
  try {
    const spec = await readSpec(REPO_ROOT, req.params.id);
    const concepts = await readConcepts(REPO_ROOT, req.params.id).catch(
      () => spec.concepts,
    );
    res.json(explorationVerification(concepts, spec.jtbd));
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

// cerrar Exploración: promueve los seleccionados a la spec + Decision + etapa diseno
// POST /api/specs/:id/exploration/close  { rationale, by }
app.post("/api/specs/:id/exploration/close", async (req, res) => {
  const rationale = String(req.body?.rationale ?? "").trim();
  const by = String(req.body?.by ?? "").trim();
  if (!rationale)
    return res.status(400).json({ error: "falta el rationale del cierre" });
  if (!by) return res.status(400).json({ error: "falta el responsable (by)" });
  try {
    const r = await closeExploration(REPO_ROOT, req.params.id, {
      rationale,
      by,
      author: { name: by, email: "exploration@pda.local" },
    });
    res.json(r);
  } catch (err) {
    res.status(409).json({ error: String(err) });
  }
});

// --- corridas de agente disparadas desde la UI (Sesión 16) ---

const SAMPLE_FALLBACK = {
  entrevistasDir: join(REPO_ROOT, "samples", "entrevistas"),
  funnelCsv: join(REPO_ROOT, "samples", "analitica", "funnel-otp.csv"),
};

/** ¿Existe una propuesta de Definición pendiente (spec.proposed.yaml)? */
async function hasProposalFile(specId: string): Promise<boolean> {
  try {
    await readProposedSpec(REPO_ROOT, specId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Chequeo SÍNCRONO de precondición (barato, sin modelo) para dar un 400 inmediato antes de
 * arrancar el job. Los run* del orquestador re-chequean (defensa en profundidad).
 */
async function assertCanRun(specId: string, agent: AgentName): Promise<void> {
  if (agent === "define") {
    const findings = await readFindings(REPO_ROOT, specId);
    if (findings.length === 0) {
      throw new Error(
        "no hay hallazgos validados; corré Descubrimiento (discover) primero",
      );
    }
  }
  if (agent === "explore") {
    const spec = await readSpec(REPO_ROOT, specId);
    if (spec.status !== "approved") {
      throw new Error(
        `la spec debe estar 'approved' para explorar (estado actual: ${spec.status})`,
      );
    }
    if (spec.jtbd.length === 0) {
      throw new Error("la spec no tiene JTBD; corré Definición y aprobá la compuerta");
    }
    if (await hasProposalFile(specId)) {
      throw new Error(
        "hay una propuesta de Definición pendiente; aprobala o descartala antes de explorar",
      );
    }
  }
}

/** Corre el agente real vía el orquestador y devuelve el resumen (+ tokens, P3). */
async function runAgent(
  specId: string,
  agent: AgentName,
  by: string,
): Promise<{ result: AgentRunSummary; tokens?: TokenUsage }> {
  const spec = await readSpec(REPO_ROOT, specId);
  const topic = resolveTopic(spec);
  const author = { name: by, email: "operator@pda.local" };

  if (agent === "discover") {
    const r = await runDiscoveryWithSources(REPO_ROOT, specId, {
      topic,
      fallback: SAMPLE_FALLBACK,
      author,
      actor: by,
    });
    return { result: { agent, counts: { hallazgos: r.findings.length } } };
  }
  if (agent === "define") {
    const gate = await runDefinition(REPO_ROOT, specId, {
      runner: createDefinitionRunner({ topic }),
      author,
      actor: by,
    });
    return {
      result: {
        agent,
        counts: {
          jtbd: gate.proposed.jtbd.length,
          metricas: gate.proposed.outcomes.length,
        },
      },
    };
  }
  const r = await runExploration(REPO_ROOT, specId, {
    runner: createExplorationRunner({ topic }),
    author,
    actor: by,
  });
  return { result: { agent, counts: { conceptos: r.concepts.length } } };
}

// preflight: costo estimado de la corrida ANTES de gastar tokens (P2)
app.get("/api/specs/:id/run/:agent/preflight", async (req, res) => {
  const agent = req.params.agent;
  if (!isAgentName(agent)) {
    return res.status(404).json({ error: `agente desconocido: ${agent}` });
  }
  const id = req.params.id;
  try {
    if (agent === "discover") {
      const pf = await discoverPreflight(REPO_ROOT, id, SAMPLE_FALLBACK);
      return res.json({ agent, willDerive: true, ...pf });
    }
    if (agent === "define") {
      const findings = await readFindings(REPO_ROOT, id);
      return res.json({
        agent,
        modelCalls: 1,
        findings: findings.length,
        alreadyRan: await hasProposalFile(id),
      });
    }
    // explore: re-correr es merge no destructivo (P3 de la sesión 15c)
    const concepts = await readConcepts(REPO_ROOT, id);
    return res.json({
      agent,
      modelCalls: 1,
      alreadyRan: concepts.length > 0,
      mergeMode: true,
    });
  } catch (err) {
    res
      .status(400)
      .json({ error: String(err instanceof Error ? err.message : err) });
  }
});

// arrancar una corrida: 400 si falla la precondición, 409 si ya hay una en curso
app.post("/api/specs/:id/run/:agent", async (req, res) => {
  const { id } = req.params;
  const agent = req.params.agent;
  if (!isAgentName(agent)) {
    return res.status(404).json({ error: `agente desconocido: ${agent}` });
  }
  const by = String(req.body?.by ?? "").trim() || "operador";

  try {
    await assertCanRun(id, agent);
  } catch (err) {
    return res.status(400).json({ error: String(err instanceof Error ? err.message : err) });
  }

  try {
    const job = startAgentJob(id, agent, by, () => runAgent(id, agent, by));
    res.status(202).json(jobView(job));
  } catch (err) {
    if (err instanceof JobConflictError) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: String(err) });
  }
});

// estado de la corrida (la UI poll-ea esto)
app.get("/api/specs/:id/run/:agent", (req, res) => {
  const agent = req.params.agent;
  if (!isAgentName(agent)) {
    return res.status(404).json({ error: `agente desconocido: ${agent}` });
  }
  res.json(jobView(getJob(req.params.id, agent)));
});

app.listen(PORT, () => {
  console.log(`[dashboard server] leyendo specs de ${SPECS_DIR}`);
  console.log(`[dashboard server] escuchando en http://localhost:${PORT}`);
});
