#!/usr/bin/env node
// CLI del orquestador. Corre desde la raíz del repo (lee/escribe ./specs).
//   node --env-file=.env packages/orchestrator/dist/cli.js run <specId>
//   node packages/orchestrator/dist/cli.js status <specId>
//   node packages/orchestrator/dist/cli.js approve <specId> --by "Nombre"
//   node packages/orchestrator/dist/cli.js iterate <specId> --feedback "texto"

import { join } from "node:path";

import { blockingPasses } from "./verify.js";
import { getState, runStage, approveGate, iterateGate } from "./stage.js";
import { createAgent1Runner } from "./runner.js";

const ROOT = process.cwd();
const TOPIC = "abandono en la verificación OTP del onboarding";
const AUTHOR = {
  name: process.env["PDA_AUTHOR_NAME"] ?? "orchestrator",
  email: process.env["PDA_AUTHOR_EMAIL"] ?? "orchestrator@pda.local",
};

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const [, , cmd, specId] = process.argv;
  if (!cmd || !specId) {
    console.log(
      "Uso: orchestrator <run|status|approve|iterate> <specId> [flags]",
    );
    process.exit(cmd ? 1 : 0);
  }

  if (cmd === "status") {
    console.log(await getState(ROOT, specId));
    return;
  }

  if (cmd === "run") {
    const runner = createAgent1Runner({
      entrevistasDir: join(ROOT, "samples", "entrevistas"),
      funnelCsv: join(ROOT, "samples", "analitica", "funnel-otp.csv"),
      topic: TOPIC,
    });
    const gate = await runStage(ROOT, specId, { runner, author: AUTHOR });
    console.log(
      `\n▸ Etapa corrida. BLOQUEADO en compuerta '${gate.gate}' (sin subir versión).`,
    );
    console.log(
      `  hallazgos: ${gate.proposed.findings.length} · propuesta: v${gate.proposed.version} ${gate.proposed.status}`,
    );
    console.log(`\n  Verificación automatizada:`);
    for (const c of gate.verification) {
      console.log(
        `   [${c.status === "pass" ? "✓" : "✗"}] ${c.criterion} — ${c.evidence}`,
      );
    }
    console.log(
      `\n  ${blockingPasses(gate.verification) ? "Listo para aprobar" : "Bloqueado: corrige antes de aprobar"}.`,
    );
    console.log(
      `  Aprueba con: orchestrator approve ${specId} --by "Tu Nombre"`,
    );
    return;
  }

  if (cmd === "approve") {
    const approver = flag("by");
    if (!approver) {
      console.error('Falta --by "Nombre del aprobador"');
      process.exit(1);
    }
    const next = await approveGate(ROOT, specId, { approver, author: AUTHOR });
    console.log(
      `✓ Compuerta aprobada por ${approver} → v${next.version} (${next.status}, etapa ${next.current_stage}).`,
    );
    return;
  }

  if (cmd === "iterate") {
    const feedback = flag("feedback") ?? "(sin feedback)";
    await iterateGate(ROOT, specId, { feedback, actor: flag("by") ?? "human" });
    console.log(`↺ Iteración registrada: "${feedback}"`);
    return;
  }

  console.error(`Comando desconocido: ${cmd}`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
