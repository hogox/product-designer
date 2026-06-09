// Corrida REAL del paso 1.6: pipeline completo del Agente 1 →
//   recolectar → extraer evidencia → computar → derivar → SINTETIZAR.
// Produce la propuesta v+1 (spec.proposed.yaml) + findings.yaml en el almacén de spec.
// Uso: node --env-file=.env packages/agent1/dist/demo-synthesize.js
//
// Nota: en el pipeline real la validación HUMANA de hallazgos (triage) ocurre antes de
// sintetizar (paso 1.8). Aquí, para la demo, tomamos los hallazgos derivados como validados.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Evidence } from "@pda/spec";
import { readSpec, writeProposedSpec, writeFindings } from "@pda/spec";

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
  synthesizeProposal,
  createAnthropicSynthesizer,
} from "./index.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TOPIC = "abandono en la verificación OTP del onboarding";
const SPEC_ID = "otp-onboarding";

async function main() {
  // recolectar + extraer (cualitativo) + computar (cuantitativo)
  const evidence: Evidence[] = [];
  const proposer = createAnthropicProposer();
  for (const doc of await ingestDir(join(REPO, "samples", "entrevistas"))) {
    if (doc.kind !== "text") continue;
    const { accepted } = await extractTextEvidence(doc, {
      topic: TOPIC,
      proposer,
    });
    evidence.push(...accepted);
  }
  const funnel = await ingestCsv(
    join(REPO, "samples", "analitica", "funnel-otp.csv"),
  );
  evidence.push(
    ...computeFunnelMetrics(funnel).slice(0, 4).map(metricToEvidence),
  );

  // derivar hallazgos (solo desde el pool)
  const pool = buildEvidencePool(evidence);
  const { accepted: findings } = await deriveFindings(pool, {
    topic: TOPIC,
    proposer: createAnthropicFindingsProposer(),
  });

  // sintetizar la propuesta (Definición ligera) desde los hallazgos
  const current = await readSpec(REPO, SPEC_ID);
  const proposed = await synthesizeProposal(current, findings, {
    topic: TOPIC,
    synthesizer: createAnthropicSynthesizer(),
  });

  // persistir propuesta + findings en el almacén de spec
  await writeFindings(REPO, SPEC_ID, proposed.findings);
  const path = await writeProposedSpec(REPO, proposed);

  console.log(`Propuesta escrita en: ${path.replace(REPO + "/", "")}`);
  console.log(`\nProblem statement:\n  ${proposed.problem_statement}`);
  console.log(`\nOutcomes (${proposed.outcomes.length}):`);
  for (const o of proposed.outcomes) {
    console.log(
      `  · ${o.metric}: baseline=${o.baseline ?? "—"} → target=${o.target} (${o.method})`,
    );
  }
  console.log(`\nAlcance:`);
  console.log(`  in-scope: ${proposed.scope.in_scope.join("; ")}`);
  console.log(`  non-goals: ${proposed.scope.non_goals.join("; ")}`);
  const hyps = proposed.tasks.filter((t) => t.id.startsWith("H-"));
  console.log(`\nHipótesis → tareas (${hyps.length}):`);
  for (const h of hyps) console.log(`  · ${h.description}`);
  console.log(
    `\nHallazgos promovidos (validados): ${proposed.findings.length}`,
  );
  console.log(
    `Estado de la propuesta: v${proposed.version} · ${proposed.status} (la versión sube en la compuerta)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
