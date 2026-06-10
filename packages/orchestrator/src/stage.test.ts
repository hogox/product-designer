import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  createSpecV0,
  writeSpec,
  readSpec,
  readAudit,
  readFindings,
  readProposedSpec,
  type Finding,
  type Spec,
} from "@pda/spec";

import {
  runDiscovery,
  runDefinition,
  approveGate,
  iterateGate,
  rejectFinding,
  reviewFinding,
  getState,
  automatedVerification,
  blockingPasses,
  type DiscoveryRunner,
  type DefinitionRunner,
} from "./index.js";

const execFileAsync = promisify(execFile);
const AUTHOR = { name: "Test", email: "test@example.com" };

function finding(id: string, kind: "q" | "t"): Finding {
  return kind === "t"
    ? {
        id,
        statement: "El drop-off en OTP es alto",
        type: "quantitative",
        evidence: [
          {
            source: "funnel.csv",
            locator: "hoja 'csv' (n=315)",
            computation: "drop-off OTP = 43.2% (136/315, n=315)",
          },
        ],
        confidence: "high",
        status: "validated",
        feeds: "outcomes",
        reviewed_by: null,
        review_note: null,
        review_status: "pendiente",
        reviewed_at: null,
      }
    : {
        id,
        statement: "Abandonan esperando el código",
        type: "qualitative",
        evidence: [
          {
            source: "e1.txt",
            locator: "párrafo 3",
            quote: "me cansé de esperar",
          },
        ],
        confidence: "medium",
        status: "validated",
        feeds: "scope",
        reviewed_by: null,
        review_note: null,
        review_status: "pendiente",
        reviewed_at: null,
      };
}

function discoveryStub(findings: Finding[]): DiscoveryRunner {
  return {
    async run() {
      return { findings };
    },
  };
}

function definitionStub(): DefinitionRunner {
  return {
    async run(current: Spec, findings: Finding[]) {
      const proposed: Spec = {
        ...current,
        status: "in_review",
        current_stage: "definicion",
        problem_statement: "Los usuarios abandonan en OTP.",
        outcomes: [
          {
            metric: "completitud OTP",
            baseline: "56.8%",
            target: "≥80%",
            method: "GSM",
            heart: "task_success",
            signals: ["completitud"],
          },
        ],
        jtbd: [
          {
            id: "J-001",
            statement:
              "Cuando verifico, quiero confirmar rápido, para no abandonar",
            supported_by: [findings[0]!.id],
          },
        ],
        findings,
      };
      return { proposed };
    },
  };
}

async function tempRepoWithSpec(): Promise<{ root: string; id: string }> {
  const root = await mkdtemp(join(tmpdir(), "pda-orch-"));
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  const id = "otp";
  await writeSpec(root, createSpecV0({ id, title: "Reducir abandono OTP" }));
  await execFileAsync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "add", "-A"],
    { cwd: root },
  );
  await execFileAsync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "seed"],
    { cwd: root },
  );
  return { root, id };
}

test("runDiscovery persiste hallazgos, verifica y audita (sin gatear)", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    const r = await runDiscovery(root, id, {
      runner: discoveryStub([finding("F-001", "t"), finding("F-002", "q")]),
      author: AUTHOR,
    });
    assert.equal(r.stage, "descubrimiento");
    assert.equal(r.findings.length, 2);
    assert.equal(blockingPasses(r.verification), true);
    // findings persistidos, sin propuesta todavía
    const st = await getState(root, id);
    assert.equal(st.findings, 2);
    assert.equal(st.hasProposal, false);
    assert.equal(st.version, 0);
    const audit = await readAudit(root, id);
    assert.ok(audit.some((a) => a.action === "agent.proposed"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejectFinding (compat) ya NO borra: marca rechazado + comentario + audita", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await runDiscovery(root, id, {
      runner: discoveryStub([finding("F-001", "t"), finding("F-002", "q")]),
      author: AUTHOR,
    });
    const remaining = await rejectFinding(root, id, "F-002", {
      reason: "la cita no respalda la afirmación",
      actor: "Lead",
    });
    // no se borra: siguen los 2, F-002 queda rechazado con su comentario
    assert.equal(remaining.length, 2);
    const f2 = (await readFindings(root, id)).find((f) => f.id === "F-002");
    assert.equal(f2?.review_status, "rechazado");
    assert.equal(f2?.review_note, "la cita no respalda la afirmación");
    assert.equal(f2?.reviewed_by, "Lead");
    assert.ok(f2?.reviewed_at);
    const audit = await readAudit(root, id);
    assert.equal(
      audit.find((a) => a.action === "finding.reject")?.target,
      "F-002",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reviewFinding aprueba un hallazgo (no exige comentario) y audita finding.approve", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await runDiscovery(root, id, {
      runner: discoveryStub([finding("F-001", "t")]),
      author: AUTHOR,
    });
    const f = await reviewFinding(root, id, "F-001", {
      status: "aprobado",
      actor: "Hugo",
    });
    assert.equal(f.review_status, "aprobado");
    assert.equal(f.reviewed_by, "Hugo");
    const audit = await readAudit(root, id);
    assert.equal(audit.at(-1)?.action, "finding.approve");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reviewFinding exige comentario para rechazado y en_pausa", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await runDiscovery(root, id, {
      runner: discoveryStub([finding("F-001", "t")]),
      author: AUTHOR,
    });
    await assert.rejects(
      () =>
        reviewFinding(root, id, "F-001", { status: "en_pausa", actor: "Hugo" }),
      /exige un comentario/,
    );
    await assert.rejects(
      () =>
        reviewFinding(root, id, "F-001", {
          status: "rechazado",
          comment: "   ",
          actor: "Hugo",
        }),
      /exige un comentario/,
    );
    // pausar con comentario sí funciona → audita finding.pause
    const f = await reviewFinding(root, id, "F-001", {
      status: "en_pausa",
      comment: "necesito validar con analítica",
      actor: "Hugo",
    });
    assert.equal(f.review_status, "en_pausa");
    const audit = await readAudit(root, id);
    assert.equal(audit.at(-1)?.action, "finding.pause");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reviewFinding espeja el estado en la propuesta de Definición", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await runDiscovery(root, id, {
      runner: discoveryStub([finding("F-001", "t"), finding("F-002", "q")]),
      author: AUTHOR,
    });
    await runDefinition(root, id, { runner: definitionStub(), author: AUTHOR });
    await reviewFinding(root, id, "F-001", { status: "aprobado", actor: "Hugo" });
    const proposed = await readProposedSpec(root, id);
    assert.equal(
      proposed.findings.find((f) => f.id === "F-001")?.review_status,
      "aprobado",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runDefinition propone, verifica y BLOQUEA en el gate (sin subir versión)", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await runDiscovery(root, id, {
      runner: discoveryStub([finding("F-001", "t"), finding("F-002", "q")]),
      author: AUTHOR,
    });
    const gate = await runDefinition(root, id, {
      runner: definitionStub(),
      author: AUTHOR,
    });
    assert.equal(gate.blocked, true);
    assert.equal(gate.gate, "enmarcar");
    assert.equal(gate.proposed.jtbd.length, 1);
    assert.equal(blockingPasses(gate.verification), true);
    const current = await readSpec(root, id);
    assert.equal(current.version, 0); // sin subir
    const st = await getState(root, id);
    assert.equal(st.hasProposal, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runDefinition falla si no hay hallazgos validados", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await assert.rejects(
      () =>
        runDefinition(root, id, { runner: definitionStub(), author: AUTHOR }),
      /no hay hallazgos validados/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("flujo completo: discover → define → approve sube a v1 con history", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await runDiscovery(root, id, {
      runner: discoveryStub([finding("F-001", "t"), finding("F-002", "q")]),
      author: AUTHOR,
    });
    await runDefinition(root, id, { runner: definitionStub(), author: AUTHOR });
    const next = await approveGate(root, id, {
      approver: "Lead PM",
      author: AUTHOR,
    });
    assert.equal(next.version, 1);
    assert.equal(next.status, "approved");
    assert.equal(next.current_stage, "definicion");
    assert.equal(next.history.at(-1)?.approved_by, "Lead PM");
    assert.ok(next.jtbd.length >= 1);
    const audit = await readAudit(root, id);
    assert.ok(audit.some((a) => a.action === "gate.approve"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("automatedVerification + iterateGate", async () => {
  assert.equal(
    blockingPasses(automatedVerification([finding("F-1", "t")])),
    true,
  );
  const { root, id } = await tempRepoWithSpec();
  try {
    await iterateGate(root, id, {
      feedback: "faltan datos de Android",
      actor: "Lead",
    });
    const audit = await readAudit(root, id);
    assert.match(
      audit.find((a) => a.action === "gate.iterate")?.reason ?? "",
      /Android/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
