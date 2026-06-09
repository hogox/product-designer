// Server delgado del dashboard: SOLO lee el almacén de spec (PRD §14: centrado en la spec).
// No ejecuta agentes ni muta versiones — eso llega con el orquestador (Fase 1, pasos 1.7–1.8).

import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { readAudit, readSpec, readProposedSpec, readFindings } from "@pda/spec";
import {
  getState,
  approveGate,
  rejectFinding,
  iterateGate,
} from "@pda/orchestrator";

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
    status: "mock",
    real: false,
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

app.get("/api/specs", async (_req, res) => {
  try {
    const entries = await readdir(SPECS_DIR, { withFileTypes: true });
    res.json(entries.filter((e) => e.isDirectory()).map((e) => e.name));
  } catch {
    res.json([]);
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

app.listen(PORT, () => {
  console.log(`[dashboard server] leyendo specs de ${SPECS_DIR}`);
  console.log(`[dashboard server] escuchando en http://localhost:${PORT}`);
});
