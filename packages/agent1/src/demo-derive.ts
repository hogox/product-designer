// Corrida REAL del paso 1.5 contra la Claude API. Uso:
//   node --env-file=.env packages/agent1/dist/demo-derive.js
// documentos → evidencia (citas reales verificadas + cómputo determinista) → pool →
// hallazgos derivados SOLO desde el pool. Muestra los hallazgos con su evidencia anclada.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Evidence } from "@pda/spec";

import {
  ingestDir,
  ingestCsv,
  extractTextEvidence,
  createAnthropicProposer,
  computeFunnelMetrics,
  metricToEvidence,
  buildEvidencePool,
  deriveFindings,
  createAnthropicFindingsProposer,
} from "./index.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TOPIC = "abandono en la verificación OTP del onboarding";

async function main() {
  const evidence: Evidence[] = [];

  // 1) evidencia CUALITATIVA: extraer citas verificadas de cada entrevista
  const proposer = createAnthropicProposer();
  const docs = await ingestDir(join(REPO, "samples", "entrevistas"));
  for (const doc of docs) {
    if (doc.kind !== "text") continue;
    const { accepted } = await extractTextEvidence(doc, {
      topic: TOPIC,
      proposer,
    });
    evidence.push(...accepted);
  }
  const citas = evidence.length;

  // 2) evidencia CUANTITATIVA: computar métricas del funnel (determinista)
  const funnel = await ingestCsv(
    join(REPO, "samples", "analitica", "funnel-otp.csv"),
  );
  const metrics = computeFunnelMetrics(funnel).slice(0, 4); // drop-off global + 2 segmentos + espera
  evidence.push(...metrics.map(metricToEvidence));

  console.log(
    `Pool de evidencia: ${citas} citas + ${metrics.length} cálculos = ${evidence.length}\n`,
  );

  // 3) derivar hallazgos SOLO desde el pool
  const pool = buildEvidencePool(evidence);
  const { accepted, rejected } = await deriveFindings(pool, {
    topic: TOPIC,
    proposer: createAnthropicFindingsProposer(),
  });

  console.log(`Hallazgos derivados (${accepted.length}):\n`);
  for (const f of accepted) {
    console.log(
      `▸ [${f.id}] (${f.type}, ${f.confidence}, →${f.feeds}) ${f.statement}`,
    );
    for (const e of f.evidence) {
      const anchor = e.quote ? `"${e.quote}"` : e.computation;
      console.log(`    └ ${e.source} · ${e.locator}: ${anchor}`);
    }
  }
  if (rejected.length > 0) {
    console.log(`\nRechazados (${rejected.length}):`);
    for (const r of rejected)
      console.log(`  · ${r.raw.statement} — ${r.reason}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
