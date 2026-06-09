// Corrida REAL del paso 1.4 contra la Claude API. Uso:
//   node --env-file=.env packages/agent1/dist/demo-extract.js
// Ingiere una entrevista del set y extrae evidencia (citas ancladas), verificada
// contra la fuente. Muestra aceptadas (con locator real) y rechazadas (alucinadas).

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ingestText,
  createAnthropicProposer,
  extractTextEvidence,
} from "./index.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TOPIC = "abandono en la verificación OTP del onboarding";

async function main() {
  const file = process.argv[2]
    ? resolve(process.argv[2])
    : join(REPO, "samples", "entrevistas", "entrevista-01.txt");

  const doc = await ingestText(file);
  console.log(`Fuente: ${doc.source} (${doc.segments.length} segmentos)`);
  console.log(`Modelo: ${process.env["PDA_MODEL"] ?? "claude-opus-4-8"}\n`);

  const proposer = createAnthropicProposer();
  const { accepted, rejected } = await extractTextEvidence(doc, {
    topic: TOPIC,
    proposer,
  });

  console.log(
    `✓ Evidencia aceptada (${accepted.length}) — anclada y verificada:`,
  );
  for (const e of accepted) {
    console.log(`  · [${e.source} · ${e.locator}] "${e.quote}"`);
  }
  console.log(
    `\n✗ Candidatos rechazados (${rejected.length}) — no existen en la fuente:`,
  );
  for (const r of rejected) {
    console.log(`  · "${r.candidate.quote}" — ${r.reason}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
