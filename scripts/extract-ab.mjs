// A/B de modelo de extracción: Opus vs Haiku (Sesión 13 — O1, Paso 5).
// Aísla la variable AL MODELO DE EXTRACCIÓN: extrae el corpus DOS veces con distinto
// modelo, pero deriva AMBAS veces con el mismo Opus (para no confundir variables).
// Compara: citas aceptadas, tasa de rechazo (alucinación) y cobertura de hallazgos.
//
//   node --env-file=.env scripts/extract-ab.mjs
//
// Guarda los outputs en /tmp/extract-ab/{opus,haiku}.json y un resumen en consola.
// Usa --no-cache para forzar re-extracción independientemente del cache.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { extname } from "node:path";

import {
  ingestFile,
  extractTextEvidence,
  createAnthropicProposer,
  computeFunnelMetrics,
  metricToEvidence,
  buildEvidencePool,
  deriveFindings,
  createAnthropicFindingsProposer,
} from "../packages/agent1/dist/index.js";

const ROOT = process.cwd();
const TOPIC = "abandono en la verificación OTP del onboarding";
const OUT = "/tmp/extract-ab";
const SAMPLES_TEXT = join(ROOT, "samples", "entrevistas");
const SAMPLES_FUNNEL = join(ROOT, "samples", "analitica", "funnel-otp.csv");

async function listTextFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && [".txt", ".pdf"].includes(extname(e.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => join(dir, e.name));
}

async function runExtraction(modelId) {
  console.log(`\n▶ Extracción con ${modelId}…`);
  const proposer = createAnthropicProposer({ model: modelId });
  const evidence = [];
  const stats = { sources: 0, accepted: 0, rejected: 0 };

  const textFiles = await listTextFiles(SAMPLES_TEXT);
  for (const filePath of textFiles) {
    for (const doc of await ingestFile(filePath)) {
      if (doc.kind === "text") {
        const { accepted, rejected } = await extractTextEvidence(doc, {
          topic: TOPIC,
          proposer,
        });
        stats.sources++;
        stats.accepted += accepted.length;
        stats.rejected += rejected.length;
        evidence.push(...accepted);
        console.log(
          `  ${doc.source}: ${accepted.length} aceptadas, ${rejected.length} rechazadas`,
        );
      }
    }
  }

  // tabular (determinista — igual para ambos modelos)
  for (const doc of await ingestFile(SAMPLES_FUNNEL)) {
    if (doc.kind === "tabular") {
      evidence.push(...computeFunnelMetrics(doc).slice(0, 4).map(metricToEvidence));
    }
  }

  return { modelId, stats, evidence };
}

async function runDerivation(evidence, label) {
  // Siempre Opus para la derivación (aísla la variable)
  const pool = buildEvidencePool(evidence);
  const { accepted: findings, rejected } = await deriveFindings(pool, {
    topic: TOPIC,
    proposer: createAnthropicFindingsProposer({ model: "claude-opus-4-8" }),
  });
  return { findings, rejectedFindings: rejected };
}

function summarize(run) {
  const { modelId, stats } = run;
  const total = stats.accepted + stats.rejected;
  const rejectRate = total > 0 ? ((stats.rejected / total) * 100).toFixed(1) : "0.0";
  console.log(`\n── ${modelId} ──`);
  console.log(`  Fuentes text: ${stats.sources}`);
  console.log(`  Citas aceptadas: ${stats.accepted}`);
  console.log(`  Citas rechazadas (alucinación): ${stats.rejected} (${rejectRate}%)`);
  console.log(`  Hallazgos derivados: ${run.findings.length}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const opusRun = await runExtraction("claude-opus-4-8");
  const haikuRun = await runExtraction("claude-haiku-4-5");

  console.log("\n▶ Derivando con Opus desde pool de Opus…");
  const { findings: opusFindings } = await runDerivation(opusRun.evidence, "opus");
  opusRun.findings = opusFindings;

  console.log("▶ Derivando con Opus desde pool de Haiku…");
  const { findings: haikuFindings } = await runDerivation(haikuRun.evidence, "haiku");
  haikuRun.findings = haikuFindings;

  await writeFile(join(OUT, "opus.json"), JSON.stringify(opusRun, null, 2));
  await writeFile(join(OUT, "haiku.json"), JSON.stringify(haikuRun, null, 2));

  console.log("\n════════════════ RESUMEN A/B ════════════════");
  summarize(opusRun);
  summarize(haikuRun);

  // Cobertura: % de citas de Haiku que tienen equivalente en Opus (por quote)
  const opusQuotes = new Set(opusRun.evidence.map((e) => e.quote?.trim()));
  const haikuInOpus = haikuRun.evidence.filter(
    (e) => e.quote && opusQuotes.has(e.quote.trim()),
  ).length;
  const coverage =
    opusRun.evidence.length > 0
      ? ((haikuInOpus / opusRun.evidence.length) * 100).toFixed(1)
      : "n/a";

  console.log(`\n  Citas Haiku que coinciden con Opus: ${haikuInOpus}/${opusRun.evidence.length} (${coverage}%)`);

  const opusRejectRate =
    (opusRun.stats.rejected / (opusRun.stats.accepted + opusRun.stats.rejected)) * 100;
  const haikuRejectRate =
    (haikuRun.stats.rejected / (haikuRun.stats.accepted + haikuRun.stats.rejected)) * 100;

  console.log("\n  Criterio de adopción (≥90% cobertura, sin subir tasa de rechazo):");
  const coverageOk = parseFloat(coverage) >= 90;
  const rejectOk = haikuRejectRate <= opusRejectRate * 1.1; // tolerancia 10%
  console.log(`    Cobertura ≥90%: ${coverageOk ? "✅" : "❌"} (${coverage}%)`);
  console.log(
    `    Rechazo no sube: ${rejectOk ? "✅" : "❌"} (opus=${opusRejectRate.toFixed(1)}% haiku=${haikuRejectRate.toFixed(1)}%)`,
  );

  if (coverageOk && rejectOk) {
    console.log("\n  ✅ Haiku pasa el gate → se puede setear PDA_MODEL_EXTRACT=claude-haiku-4-5 por defecto");
  } else {
    console.log("\n  ❌ Haiku NO pasa el gate → mantener Opus para extracción");
  }

  console.log(`\nOutputs guardados en ${OUT}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
