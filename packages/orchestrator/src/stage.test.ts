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
  type Finding,
  type Spec,
} from "@pda/spec";

import {
  runStage,
  approveGate,
  iterateGate,
  rejectFinding,
  getState,
  automatedVerification,
  blockingPasses,
  type DiscoveryRunner,
} from "./index.js";

const execFileAsync = promisify(execFile);
const AUTHOR = { name: "Test", email: "test@example.com" };

const goodFinding: Finding = {
  id: "F-001",
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
};

const qualFinding: Finding = {
  id: "F-002",
  statement: "Abandonan esperando el código",
  type: "qualitative",
  evidence: [
    { source: "e1.txt", locator: "párrafo 3", quote: "me cansé de esperar" },
  ],
  confidence: "medium",
  status: "validated",
  feeds: "scope",
  reviewed_by: null,
  review_note: null,
};

function stubRunner(findings: Finding[]): DiscoveryRunner {
  return {
    async run(current: Spec) {
      const proposed: Spec = {
        ...current,
        status: "in_review",
        problem_statement: "Los usuarios abandonan en OTP.",
        outcomes: [
          {
            metric: "completitud OTP",
            baseline: "56.8%",
            target: "≥80%",
            method: "GSM",
          },
        ],
        findings,
      };
      return { findings, proposed };
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

test("automatedVerification pasa con hallazgos anclados y falla si no", () => {
  assert.equal(
    blockingPasses(automatedVerification([goodFinding, qualFinding])),
    true,
  );
  const broken = { ...goodFinding, evidence: [] } as Finding;
  assert.equal(blockingPasses(automatedVerification([broken])), false);
});

test("runStage propone, verifica y BLOQUEA sin subir versión", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    const gate = await runStage(root, id, {
      runner: stubRunner([goodFinding, qualFinding]),
      author: AUTHOR,
    });
    assert.equal(gate.blocked, true);
    assert.equal(gate.gate, "enmarcar");
    assert.equal(blockingPasses(gate.verification), true);
    // la versión NO subió
    const current = await readSpec(root, id);
    assert.equal(current.version, 0);
    assert.equal(current.status, "draft");
    // estado refleja propuesta pendiente
    const st = await getState(root, id);
    assert.equal(st.hasProposal, true);
    assert.equal(st.findings, 2);
    // auditoría registró el arranque y la propuesta
    const audit = await readAudit(root, id);
    assert.ok(audit.some((a) => a.action === "stage.start"));
    assert.ok(audit.some((a) => a.action === "agent.proposed"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("approveGate sube versión, registra history y audita", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await runStage(root, id, {
      runner: stubRunner([goodFinding, qualFinding]),
      author: AUTHOR,
    });
    const next = await approveGate(root, id, {
      approver: "Lead PM",
      author: AUTHOR,
    });
    assert.equal(next.version, 1);
    assert.equal(next.status, "approved");
    assert.equal(next.history.at(-1)?.approved_by, "Lead PM");
    // persistido
    const onDisk = await readSpec(root, id);
    assert.equal(onDisk.version, 1);
    const audit = await readAudit(root, id);
    assert.ok(audit.some((a) => a.action === "gate.approve"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejectFinding quita el hallazgo y audita el motivo (invariante 7)", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await runStage(root, id, {
      runner: stubRunner([goodFinding, qualFinding]),
      author: AUTHOR,
    });
    const updated = await rejectFinding(root, id, "F-002", {
      reason: "la cita no respalda la afirmación",
      actor: "Lead PM",
    });
    assert.equal(updated.findings.length, 1);
    assert.equal(updated.findings[0]!.id, "F-001");
    const audit = await readAudit(root, id);
    const rej = audit.find((a) => a.action === "finding.reject");
    assert.equal(rej?.target, "F-002");
    assert.match(rej?.reason ?? "", /no respalda/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("iterateGate registra el feedback", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await iterateGate(root, id, {
      feedback: "faltan datos de Android",
      actor: "Lead",
    });
    const audit = await readAudit(root, id);
    const it = audit.find((a) => a.action === "gate.iterate");
    assert.match(it?.reason ?? "", /Android/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
