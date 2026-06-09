// Server delgado del dashboard: SOLO lee el almacén de spec (PRD §14: centrado en la spec).
// No ejecuta agentes ni muta versiones — eso llega con el orquestador (Fase 1, pasos 1.7–1.8).

import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { readAudit, readSpec } from "@pda/spec";

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
    status: "mock",
    real: false,
  },
  {
    n: 2,
    id: "definicion",
    name: "Definición",
    diamante: "Problema",
    modo: "se potencia",
    gate: "enmarcar",
    status: "mock",
    real: false,
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

app.listen(PORT, () => {
  console.log(`[dashboard server] leyendo specs de ${SPECS_DIR}`);
  console.log(`[dashboard server] escuchando en http://localhost:${PORT}`);
});
