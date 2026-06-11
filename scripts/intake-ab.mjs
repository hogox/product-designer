// Corrida comparativa del grounding del intake (Fase D2 · W6.2).
// Aísla la variable AL GROUNDING: extrae la evidencia UNA vez (mismo pool, misma fuente) y
// deriva DOS veces — sin intake y con intake — sobre ese pool idéntico. Así la diferencia en
// los hallazgos es atribuible al grounding, no a variación del modelo en la extracción.
//
//   node --env-file=.env scripts/intake-ab.mjs
//
// Guarda ambos outputs en /tmp/intake-ab/{sin,con}-intake.json y un resumen en consola.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
const OUT = "/tmp/intake-ab";

// Intake realista para el caso OTP (lo que cargaría el wizard, sesión 12).
const GROUNDING = {
  researchQuestion:
    "¿Por qué los usuarios abandonan en el paso de verificación OTP del onboarding y qué lo causa?",
  productContext:
    "Onboarding de una app bancaria regulada (CMF); el OTP se envía por SMS.",
  hypotheses: [
    "El SMS con el código tarda demasiado en llegar",
    "Falta feedback en pantalla durante la espera del código",
    "La opción de reenviar el código no es clara",
  ],
};

const FILES = [
  join(ROOT, "samples", "entrevistas", "entrevista-01.txt"),
  join(ROOT, "samples", "entrevistas", "entrevista-02.txt"),
  join(ROOT, "samples", "entrevistas", "entrevista-03.pdf"),
  join(ROOT, "samples", "analitica", "funnel-otp.csv"),
];

function summarize(label, accepted) {
  console.log(`\n──────── ${label} (${accepted.length} hallazgos) ────────`);
  for (const f of accepted) {
    console.log(
      `  [${f.confidence}/${f.type} →${f.feeds}] ${f.statement}\n      ` +
        f.evidence
          .map((e) => `${e.source} · ${e.locator}`)
          .join("\n      "),
    );
  }
}

async function main() {
  // 1) EXTRACCIÓN — una sola vez, sin sesgo (solo el topic neutral, nunca el intake).
  console.log("Extrayendo evidencia (una vez, sin grounding)…");
  const proposer = createAnthropicProposer();
  const evidence = [];
  for (const path of FILES) {
    for (const doc of await ingestFile(path)) {
      if (doc.kind === "text") {
        const { accepted } = await extractTextEvidence(doc, {
          topic: TOPIC,
          proposer,
        });
        evidence.push(...accepted);
      } else if (doc.kind === "tabular") {
        evidence.push(...computeFunnelMetrics(doc).slice(0, 4).map(metricToEvidence));
      }
    }
  }
  const pool = buildEvidencePool(evidence);
  console.log(`Pool de evidencia: ${pool.length} anclajes (idéntico para ambas corridas).`);

  // 2) DERIVACIÓN sin intake.
  console.log("\nDerivando SIN intake…");
  const sin = await deriveFindings(pool, {
    topic: TOPIC,
    proposer: createAnthropicFindingsProposer(),
  });

  // 3) DERIVACIÓN con intake (mismo pool).
  console.log("Derivando CON intake…");
  const con = await deriveFindings(pool, {
    topic: TOPIC,
    proposer: createAnthropicFindingsProposer(),
    grounding: GROUNDING,
  });

  await mkdir(OUT, { recursive: true });
  const poolDump = pool.map((p) => ({ id: p.id, ...p.evidence }));
  await writeFile(
    join(OUT, "pool.json"),
    JSON.stringify(poolDump, null, 2),
  );
  await writeFile(
    join(OUT, "sin-intake.json"),
    JSON.stringify(sin.accepted, null, 2),
  );
  await writeFile(
    join(OUT, "con-intake.json"),
    JSON.stringify({ grounding: GROUNDING, findings: con.accepted }, null, 2),
  );

  summarize("SIN intake", sin.accepted);
  summarize("CON intake", con.accepted);
  console.log(`\nOutputs guardados en ${OUT}/ (pool.json, sin-intake.json, con-intake.json).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
