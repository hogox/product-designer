// Corrida REAL del paso 2.2 contra la Claude API. Uso:
//   node --env-file=.env packages/agent2/dist/demo-define.js
// Lee la spec vigente y sus findings validados, y el Agente 2 produce el enmarcado
// completo del problema: problem statement, JTBD (anclado a findings) y métricas HEART/GSM.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readSpec, readFindings } from "@pda/spec";

import { defineProblem, createAnthropicDefiner } from "./index.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TOPIC = "abandono en la verificación OTP del onboarding";
const SPEC_ID = "otp-onboarding";

async function main() {
  const current = await readSpec(REPO, SPEC_ID);
  const findings = await readFindings(REPO, SPEC_ID);
  console.log(
    `Spec vigente: v${current.version} · ${findings.length} findings validados\n`,
  );

  const { proposed, rejectedJobs } = await defineProblem(current, findings, {
    topic: TOPIC,
    definer: createAnthropicDefiner(),
  });

  console.log(`Problem statement:\n  ${proposed.problem_statement}\n`);

  console.log(`JTBD (${proposed.jtbd.length}):`);
  for (const j of proposed.jtbd) {
    console.log(`  · [${j.id}] ${j.statement}`);
    console.log(`      ← sustentado por: ${j.supported_by.join(", ")}`);
  }

  console.log(`\nMétricas (${proposed.outcomes.length}):`);
  for (const o of proposed.outcomes) {
    console.log(`  · [${o.heart ?? "—"}] ${o.metric}`);
    console.log(`      baseline=${o.baseline ?? "—"} → target=${o.target}`);
    if (o.signals?.length)
      console.log(`      señales: ${o.signals.join("; ")}`);
  }

  if (rejectedJobs.length > 0) {
    console.log(`\nJobs rechazados (${rejectedJobs.length}):`);
    for (const r of rejectedJobs)
      console.log(`  · ${r.raw.statement} — ${r.reason}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
