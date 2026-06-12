#!/usr/bin/env node
// CLI del orquestador. Corre desde la raíz del repo (lee/escribe ./specs).
//   node --env-file=.env packages/orchestrator/dist/cli.js discover <specId>
//   node --env-file=.env packages/orchestrator/dist/cli.js define <specId>
//   node packages/orchestrator/dist/cli.js status  <specId>
//   node packages/orchestrator/dist/cli.js approve <specId> --by "Nombre"
//   node packages/orchestrator/dist/cli.js iterate <specId> --feedback "texto"

import { join } from "node:path";

import {
  createSpec,
  updateSpecMeta,
  archiveSpec,
  readSpecGroups,
  readSpec,
} from "@pda/spec";

import { blockingPasses } from "./verify.js";
import {
  getState,
  runDefinition,
  approveGate,
  iterateGate,
  discardProposal,
  rejectFinding,
  reviewFinding,
  runExploration,
  reviewConcept,
  closeExploration,
} from "./stage.js";
import {
  runDiscoveryWithSources,
  createDefinitionRunner,
  createExplorationRunner,
  resultCacheDirFor,
  resolveTopic,
} from "./runner.js";

const ROOT = process.cwd();
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

  // --- gestión multi-spec (D2 · W0): no requieren specId posicional ---

  if (cmd === "list-specs") {
    const groups = await readSpecGroups(ROOT);
    if (groups.length === 0) {
      console.log("(sin specs)");
      return;
    }
    for (const g of groups) {
      console.log(`\n▸ ${g.product}`);
      for (const s of g.specs) {
        const flagArchivada = s.status === "archivada" ? " [archivada]" : "";
        console.log(`   ${s.id} — ${s.name} · ${s.stage}${flagArchivada}`);
      }
    }
    return;
  }

  if (cmd === "create-spec") {
    const name = flag("name");
    const product = flag("product");
    if (!name || !product) {
      console.error(
        'Uso: create-spec --name "..." --product "..." [--id kebab] [--description "..."] [--by "..."]',
      );
      process.exit(1);
    }
    const entry = await createSpec(
      ROOT,
      { id: flag("id"), name, product, description: flag("description") },
      flag("by") ?? AUTHOR.name,
    );
    console.log(
      `✓ Spec creada: ${entry.id} — ${entry.name} (producto "${entry.product}", etapa ${entry.stage}).`,
    );
    return;
  }

  if (!cmd || !specId) {
    console.log(
      "Uso: orchestrator <discover|define|explore|select-concept|discard-concept|close-exploration|status|approve|iterate|discard-proposal|list-specs|create-spec|update-spec|archive-spec> <specId> [flags]",
    );
    process.exit(cmd ? 1 : 0);
  }

  if (cmd === "update-spec") {
    const patch: {
      name?: string;
      product?: string;
      description?: string;
    } = {};
    if (flag("name") !== undefined) patch.name = flag("name");
    if (flag("product") !== undefined) patch.product = flag("product");
    if (flag("description") !== undefined)
      patch.description = flag("description");
    const entry = await updateSpecMeta(
      ROOT,
      specId,
      patch,
      flag("by") ?? AUTHOR.name,
    );
    console.log(
      `✓ Metadatos actualizados: ${entry.id} — ${entry.name} (producto "${entry.product}").`,
    );
    return;
  }

  if (cmd === "archive-spec") {
    const reason = flag("reason");
    if (!reason) {
      console.error('Uso: archive-spec <specId> --reason "motivo" [--by "..."]');
      process.exit(1);
    }
    const entry = await archiveSpec(ROOT, specId, {
      reason,
      actor: flag("by") ?? AUTHOR.name,
    });
    console.log(`✓ Spec archivada (soft delete): ${entry.id} — ${entry.name}.`);
    return;
  }

  if (cmd === "status") {
    console.log(await getState(ROOT, specId));
    return;
  }

  if (cmd === "discover") {
    const topic = resolveTopic(await readSpec(ROOT, specId));
    const r = await runDiscoveryWithSources(ROOT, specId, {
      topic,
      fallback: {
        entrevistasDir: join(ROOT, "samples", "entrevistas"),
        funnelCsv: join(ROOT, "samples", "analitica", "funnel-otp.csv"),
      },
      author: AUTHOR,
    });
    const origen = r.fromSamples
      ? "samples/ (sin fuentes subidas)"
      : `${r.sourceIds.length} fuente(s) subida(s) → marcadas ingerido`;
    console.log(
      `\n▸ Descubrimiento: ${r.findings.length} hallazgos anclados. Fuentes: ${origen}.`,
    );
    printVerification(r.verification);
    console.log(`\n  Triá los hallazgos (dashboard / reject) y luego:`);
    console.log(`  orchestrator define ${specId}`);
    return;
  }

  if (cmd === "define") {
    const topic = resolveTopic(await readSpec(ROOT, specId));
    const cacheDir = resultCacheDirFor(ROOT, specId);
    const runner = createDefinitionRunner({ topic, cacheDir });
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
      `✗ Hallazgo ${fid} rechazado (queda marcado, no se borra). ${remaining.length} hallazgos en total.`,
    );
    return;
  }

  if (cmd === "review") {
    const fid = process.argv[4];
    const status = flag("status");
    const valid = ["pendiente", "aprobado", "rechazado", "en_pausa"];
    if (!fid || !status || !valid.includes(status)) {
      console.error(
        'Uso: review <specId> <findingId> --status <pendiente|aprobado|rechazado|en_pausa> [--reason "..."] [--by "..."]',
      );
      process.exit(1);
    }
    const f = await reviewFinding(ROOT, specId, fid, {
      status: status as "pendiente" | "aprobado" | "rechazado" | "en_pausa",
      comment: flag("reason"),
      actor: flag("by") ?? "Lead de diseño",
    });
    console.log(`✓ Hallazgo ${fid} → ${f.review_status}.`);
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

  if (cmd === "discard-proposal") {
    const reason = flag("reason");
    if (!reason) {
      console.error('Uso: discard-proposal <specId> --reason "motivo" [--by "..."]');
      process.exit(1);
    }
    await discardProposal(ROOT, specId, {
      reason,
      actor: flag("by") ?? AUTHOR.name,
      author: AUTHOR,
    });
    console.log(`✗ Propuesta de '${specId}' descartada: ${reason}`);
    return;
  }

  if (cmd === "explore") {
    const topic = resolveTopic(await readSpec(ROOT, specId));
    const cacheDir = resultCacheDirFor(ROOT, specId);
    const runner = createExplorationRunner({ topic, cacheDir });
    const r = await runExploration(ROOT, specId, { runner, author: AUTHOR });
    console.log(`\n▸ Exploración: ${r.concepts.length} conceptos propuestos.`);
    for (const c of r.concepts) {
      console.log(`\n  [${c.id}] ${c.title}`);
      console.log(`         ${c.description}`);
      console.log(`         JTBD: ${c.addresses_jtbd.join(", ")}`);
    }
    console.log(`\n  Triá los conceptos:`);
    console.log(`  orchestrator select-concept ${specId} <id>`);
    console.log(`  orchestrator discard-concept ${specId} <id> --reason "..."`);
    return;
  }

  if (cmd === "select-concept") {
    const cid = process.argv[4];
    if (!cid) {
      console.error("Uso: select-concept <specId> <conceptId> [--by Nombre]");
      process.exit(1);
    }
    const c = await reviewConcept(ROOT, specId, cid, {
      status: "seleccionado",
      actor: flag("by") ?? "Lead de diseño",
    });
    console.log(`✓ Concepto ${c.id} seleccionado: ${c.title}`);
    return;
  }

  if (cmd === "discard-concept") {
    const cid = process.argv[4];
    const reason = flag("reason");
    if (!cid || !reason) {
      console.error(
        'Uso: discard-concept <specId> <conceptId> --reason "motivo" [--by Nombre]',
      );
      process.exit(1);
    }
    const c = await reviewConcept(ROOT, specId, cid, {
      status: "descartado",
      note: reason,
      actor: flag("by") ?? "Lead de diseño",
    });
    console.log(`✗ Concepto ${c.id} descartado: ${c.title}`);
    return;
  }

  if (cmd === "close-exploration") {
    const rationale = flag("rationale");
    if (!rationale) {
      console.error(
        'Uso: close-exploration <specId> --rationale "por qué estos conceptos" [--by "..."]',
      );
      process.exit(1);
    }
    const r = await closeExploration(ROOT, specId, {
      rationale,
      by: flag("by") ?? AUTHOR.name,
      author: AUTHOR,
    });
    console.log(
      `✓ Exploración cerrada: ${r.promoted.length} conceptos promovidos a la spec (${r.promoted
        .map((c) => c.id)
        .join(", ")}) → etapa ${r.spec.current_stage}.`,
    );
    console.log(`  Decisión registrada: ${r.decision.id} — ${r.decision.decision}`);
    return;
  }

  console.error(`Comando desconocido: ${cmd}`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
