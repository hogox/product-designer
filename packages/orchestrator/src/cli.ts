#!/usr/bin/env node
// CLI del orquestador. Corre desde la raíz del repo (lee/escribe ./specs).
//   node --env-file=.env packages/orchestrator/dist/cli.js discover <specId>
//   node --env-file=.env packages/orchestrator/dist/cli.js define <specId>
//   node packages/orchestrator/dist/cli.js status  <specId>
//   node packages/orchestrator/dist/cli.js approve <specId> --by "Nombre"
//   node packages/orchestrator/dist/cli.js iterate <specId> --feedback "texto"

import { join } from "node:path";

import { blockingPasses } from "./verify.js";
import {
  getState,
  runDiscovery,
  runDefinition,
  approveGate,
  iterateGate,
  rejectFinding,
} from "./stage.js";
import { createDiscoveryRunner, createDefinitionRunner } from "./runner.js";

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

function printVerification(criteria: Parameters<typeof blockingPasses>[0]) {
  console.log(`\n  Verificación automatizada:`);
  for (const c of criteria) {
    console.log(
      `   [${c.status === "pass" ? "✓" : "✗"}] ${c.criterion} — ${c.evidence}`,
    );
  }
}

async function main() {
  const [, , cmd, specId] = process.argv;
  if (!cmd || !specId) {
    console.log(
      "Uso: orchestrator <discover|define|status|approve|iterate> <specId> [flags]",
    );
    process.exit(cmd ? 1 : 0);
  }

  if (cmd === "status") {
    console.log(await getState(ROOT, specId));
    return;
  }

  if (cmd === "discover") {
    const runner = createDiscoveryRunner({
      entrevistasDir: join(ROOT, "samples", "entrevistas"),
      funnelCsv: join(ROOT, "samples", "analitica", "funnel-otp.csv"),
      topic: TOPIC,
    });
    const r = await runDiscovery(ROOT, specId, { runner, author: AUTHOR });
    console.log(`\n▸ Descubrimiento: ${r.findings.length} hallazgos anclados.`);
    printVerification(r.verification);
    console.log(`\n  Triá los hallazgos (dashboard / reject) y luego:`);
    console.log(`  orchestrator define ${specId}`);
    return;
  }

  if (cmd === "define") {
    const runner = createDefinitionRunner({ topic: TOPIC });
    const gate = await runDefinition(ROOT, specId, { runner, author: AUTHOR });
    console.log(
      `\n▸ Definición. BLOQUEADO en compuerta '${gate.gate}' (sin subir versión).`,
    );
    console.log(
      `  ${gate.proposed.jtbd.length} JTBD · ${gate.proposed.outcomes.length} métricas · propuesta v${gate.proposed.version} ${gate.proposed.status}`,
    );
    printVerification(gate.verification);
    console.log(
      `\n  ${blockingPasses(gate.verification) ? "Listo para aprobar" : "Bloqueado: corrige antes de aprobar"}.`,
    );
    console.log(
      `  Aprueba con: orchestrator approve ${specId} --by "Tu Nombre"`,
    );
    return;
  }

  if (cmd === "reject") {
    const fid = process.argv[4];
    const reason = flag("reason");
    if (!fid || !reason) {
      console.error(
        'Uso: reject <specId> <findingId> --reason "motivo" [--by "Nombre"]',
      );
      process.exit(1);
    }
    const remaining = await rejectFinding(ROOT, specId, fid, {
      reason,
      actor: flag("by") ?? "Lead de diseño",
    });
    console.log(
      `✗ Hallazgo ${fid} rechazado. Quedan ${remaining.length} hallazgos.`,
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
