import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { computeFileSha256, writeEvidenceCache } from "@pda/agent1";

import {
  createSpecV0,
  writeSpec,
  writeProposedSpec,
  writeFindings,
  writeConcepts,
  readSpec,
  readAudit,
  appendAudit,
  readFindings,
  readProposedSpec,
  readConcepts,
  type Concept,
  type Finding,
  type Spec,
} from "@pda/spec";

import {
  runDiscovery,
  runDefinition,
  runExploration,
  reviewConcept,
  closeExploration,
  approveGate,
  iterateGate,
  discardProposal,
  rejectFinding,
  reviewFinding,
  getState,
  automatedVerification,
  explorationVerification,
  blockingPasses,
  resolveTopic,
  discoverPreflight,
  type DiscoveryRunner,
  type DefinitionRunner,
  type ExplorationRunner,
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
    // W2.3: con F-001 (high) pendiente, el gate bloquea por estado de revisión
    assert.equal(blockingPasses(gate.verification), false);
    const current = await readSpec(root, id);
    assert.equal(current.version, 0); // sin subir
    const st = await getState(root, id);
    assert.equal(st.hasProposal, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("W2.3: el gate bloquea con un high pendiente/en_pausa y desbloquea al resolverlo", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await runDiscovery(root, id, {
      runner: discoveryStub([finding("F-001", "t"), finding("F-002", "q")]),
      author: AUTHOR,
    });
    await runDefinition(root, id, { runner: definitionStub(), author: AUTHOR });

    // F-001 es high y arranca pendiente → bloquea
    assert.equal(
      blockingPasses((await readProposedSpec(root, id)).verification),
      false,
    );
    // pausar tampoco desbloquea (sigue sin resolver)
    await reviewFinding(root, id, "F-001", {
      status: "en_pausa",
      comment: "validar con analítica",
      actor: "Hugo",
    });
    assert.equal(
      blockingPasses((await readProposedSpec(root, id)).verification),
      false,
    );
    await assert.rejects(
      () => approveGate(root, id, { approver: "Lead PM", author: AUTHOR }),
      /no se puede aprobar/i,
    );

    // aprobar el high desbloquea (reviewFinding recomputa la verificación de la propuesta)
    await reviewFinding(root, id, "F-001", { status: "aprobado", actor: "Hugo" });
    assert.equal(
      blockingPasses((await readProposedSpec(root, id)).verification),
      true,
    );
    const next = await approveGate(root, id, {
      approver: "Lead PM",
      author: AUTHOR,
    });
    assert.equal(next.version, 1);
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
    // W2.3: hay que resolver el high pendiente antes de aprobar
    await reviewFinding(root, id, "F-001", { status: "aprobado", actor: "Hugo" });
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

// ─── runExploration + reviewConcept ───────────────────────────────────────────

function approvedSpecWithJtbd(id: string): Spec {
  return {
    ...createSpecV0({ id, title: "Reducir abandono OTP" }),
    status: "approved",
    current_stage: "definicion",
    problem_statement: "Los usuarios abandonan en el paso de verificación OTP.",
    jtbd: [
      {
        id: "J-001",
        statement:
          "Cuando verifico mi identidad, quiero confirmar el código rápido",
        supported_by: ["F-001"],
      },
    ],
    findings: [finding("F-001", "t")],
  };
}

function explorationStub(concepts: Concept[]): ExplorationRunner {
  return {
    async run() {
      return { concepts };
    },
  };
}

/** Stub realista: genera `count` conceptos con ids continuos desde firstId (como el agente real). */
function explorationStubN(count: number): ExplorationRunner {
  return {
    async run(_current, opts) {
      const start = opts?.firstId ?? 1;
      const concepts: Concept[] = [];
      for (let i = 0; i < count; i++) {
        concepts.push(concept(`C-${String(start + i).padStart(3, "0")}`));
      }
      return { concepts };
    },
  };
}

function concept(id: string): Concept {
  return {
    id,
    title: `Concepto ${id}`,
    description: "Descripción breve.",
    rationale: "Rationale.",
    addresses_jtbd: ["J-001"],
    spec_version: null,
    review_status: "propuesto",
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
  };
}

test("runExploration falla si la spec no está approved", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await assert.rejects(
      () =>
        runExploration(root, id, {
          runner: explorationStub([concept("C-001")]),
          author: AUTHOR,
        }),
      /estado.*approved|approved.*estado/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runExploration falla si la spec no tiene JTBD", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, {
      ...createSpecV0({ id, title: "OTP" }),
      status: "approved",
      current_stage: "definicion",
    });
    await assert.rejects(
      () =>
        runExploration(root, id, {
          runner: explorationStub([concept("C-001")]),
          author: AUTHOR,
        }),
      /jtbd|JTBD/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runExploration persiste conceptos, audita y commitea", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, approvedSpecWithJtbd(id));
    const r = await runExploration(root, id, {
      runner: explorationStub([concept("C-001"), concept("C-002")]),
      author: AUTHOR,
    });

    assert.equal(r.stage, "exploracion");
    assert.equal(r.concepts.length, 2);

    const persisted = await readConcepts(root, id);
    assert.equal(persisted.length, 2);
    assert.equal(persisted[0]!.id, "C-001");

    const audit = await readAudit(root, id);
    assert.ok(audit.some((a) => a.action === "agent.proposed"));
    assert.ok(audit.some((a) => a.action === "stage.start"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reviewConcept: seleccionar no exige nota y audita concept.select", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, approvedSpecWithJtbd(id));
    await runExploration(root, id, {
      runner: explorationStub([concept("C-001")]),
      author: AUTHOR,
    });

    const c = await reviewConcept(root, id, "C-001", {
      status: "seleccionado",
      actor: "Hugo",
    });
    assert.equal(c.review_status, "seleccionado");
    assert.equal(c.reviewed_by, "Hugo");
    assert.ok(c.reviewed_at);

    const audit = await readAudit(root, id);
    assert.equal(
      audit.find((a) => a.action === "concept.select")?.target,
      "C-001",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reviewConcept: descartar exige nota (invariante 7)", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, approvedSpecWithJtbd(id));
    await runExploration(root, id, {
      runner: explorationStub([concept("C-001")]),
      author: AUTHOR,
    });

    await assert.rejects(
      () =>
        reviewConcept(root, id, "C-001", {
          status: "descartado",
          actor: "Hugo",
        }),
      /exige una nota/i,
    );
    await assert.rejects(
      () =>
        reviewConcept(root, id, "C-001", {
          status: "descartado",
          note: "   ",
          actor: "Hugo",
        }),
      /exige una nota/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reviewConcept: descartar con nota audita concept.discard", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, approvedSpecWithJtbd(id));
    await runExploration(root, id, {
      runner: explorationStub([concept("C-001")]),
      author: AUTHOR,
    });

    const c = await reviewConcept(root, id, "C-001", {
      status: "descartado",
      note: "demasiado costoso de implementar",
      actor: "Hugo",
    });
    assert.equal(c.review_status, "descartado");
    assert.equal(c.review_note, "demasiado costoso de implementar");

    const audit = await readAudit(root, id);
    const entry = audit.find((a) => a.action === "concept.discard");
    assert.ok(entry);
    assert.equal(entry.target, "C-001");
    assert.match(entry.reason ?? "", /costoso/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reviewConcept: reabrir audita concept.reopen", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, approvedSpecWithJtbd(id));
    await runExploration(root, id, {
      runner: explorationStub([concept("C-001")]),
      author: AUTHOR,
    });

    await reviewConcept(root, id, "C-001", {
      status: "seleccionado",
      actor: "Hugo",
    });
    const c = await reviewConcept(root, id, "C-001", {
      status: "propuesto",
      actor: "Hugo",
    });
    assert.equal(c.review_status, "propuesto");

    const audit = await readAudit(root, id);
    assert.ok(audit.some((a) => a.action === "concept.reopen"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ─── P1: coherencia de estado + sellado de versión ──────────────────────────────

test("runExploration propaga los tokens del runner al resultado y a la auditoría (P3)", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, approvedSpecWithJtbd(id));
    const tokenRunner: ExplorationRunner = {
      async run() {
        return {
          concepts: [concept("C-001")],
          tokens: { input: 100, output: 50, total: 150 },
        };
      },
    };
    const r = await runExploration(root, id, {
      runner: tokenRunner,
      author: AUTHOR,
    });
    assert.deepEqual(r.tokens, { input: 100, output: 50, total: 150 });

    const audit = await readAudit(root, id);
    const proposed = audit.find(
      (a) => a.action === "agent.proposed" && a.actor === "agent3",
    );
    assert.match(proposed?.reason ?? "", /150 tokens/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runExploration sella spec_version en cada concepto", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, { ...approvedSpecWithJtbd(id), version: 3 });
    await runExploration(root, id, {
      runner: explorationStubN(2),
      author: AUTHOR,
    });
    const persisted = await readConcepts(root, id);
    assert.equal(persisted.length, 2);
    assert.ok(persisted.every((c) => c.spec_version === 3));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runExploration falla si hay una propuesta de Definición pendiente", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, approvedSpecWithJtbd(id));
    // dejar una propuesta colgada
    await writeProposedSpec(root, {
      ...approvedSpecWithJtbd(id),
      status: "in_review",
    });
    await assert.rejects(
      () =>
        runExploration(root, id, {
          runner: explorationStubN(2),
          author: AUTHOR,
        }),
      /propuesta de Definición pendiente|discard-proposal/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("discardProposal borra la propuesta, audita proposal.discard y exige motivo", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, approvedSpecWithJtbd(id));
    await writeProposedSpec(root, {
      ...approvedSpecWithJtbd(id),
      status: "in_review",
    });

    await assert.rejects(
      () => discardProposal(root, id, { reason: "  ", actor: "Hugo" }),
      /motivo|invariante 7/i,
    );

    await discardProposal(root, id, {
      reason: "artefacto de demo previo",
      actor: "Hugo",
      author: AUTHOR,
    });
    await assert.rejects(() => readProposedSpec(root, id)); // ya no existe

    const audit = await readAudit(root, id);
    assert.ok(audit.some((a) => a.action === "proposal.discard"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ─── P3: re-explore no destructivo ───────────────────────────────────────────────

test("re-explore conserva seleccionados/descartados y no recicla ids", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, approvedSpecWithJtbd(id));
    // primer run: C-001, C-002, C-003
    await runExploration(root, id, {
      runner: explorationStubN(3),
      author: AUTHOR,
    });
    // el humano selecciona C-001, descarta C-002 (C-003 queda propuesto)
    await reviewConcept(root, id, "C-001", {
      status: "seleccionado",
      actor: "Hugo",
    });
    await reviewConcept(root, id, "C-002", {
      status: "descartado",
      note: "muy costoso",
      actor: "Hugo",
    });

    // segundo run: 2 conceptos nuevos
    await runExploration(root, id, {
      runner: explorationStubN(2),
      author: AUTHOR,
    });

    const after = await readConcepts(root, id);
    const byId = new Map(after.map((c) => [c.id, c]));
    // se conservan los triados intactos
    assert.equal(byId.get("C-001")?.review_status, "seleccionado");
    assert.equal(byId.get("C-002")?.review_status, "descartado");
    // C-003 (propuesto) fue reemplazado
    assert.equal(byId.has("C-003"), false);
    // ids nuevos continúan desde el máximo emitido (no se recicla C-001/C-002/C-003)
    assert.ok(byId.has("C-004"));
    assert.ok(byId.has("C-005"));
    assert.equal(after.length, 4); // C-001, C-002, C-004, C-005
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ─── P4: cierre de Exploración ───────────────────────────────────────────────────

test("explorationVerification: exige ≥1 seleccionado y 0 propuestos", () => {
  const jobs = approvedSpecWithJtbd("x").jtbd;
  // sin selección + con propuestos → bloquea
  const a = explorationVerification(
    [concept("C-001"), { ...concept("C-002"), review_status: "seleccionado" }],
    jobs,
  );
  assert.equal(blockingPasses(a), false); // C-001 sigue propuesto

  // 1 seleccionado, resto descartado → pasa
  const b = explorationVerification(
    [
      { ...concept("C-001"), review_status: "seleccionado" },
      { ...concept("C-002"), review_status: "descartado", review_note: "no" },
    ],
    jobs,
  );
  assert.equal(blockingPasses(b), true);
});

test("closeExploration promueve seleccionados, registra Decision, avanza a diseno y limpia", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, { ...approvedSpecWithJtbd(id), version: 3 });
    await runExploration(root, id, {
      runner: explorationStubN(2),
      author: AUTHOR,
    });
    await reviewConcept(root, id, "C-001", {
      status: "seleccionado",
      actor: "Hugo",
    });
    await reviewConcept(root, id, "C-002", {
      status: "descartado",
      note: "fuera de alcance",
      actor: "Hugo",
    });

    const r = await closeExploration(root, id, {
      by: "Hugo Muñoz (Lead PM)",
      rationale: "C-001 ataca el job principal con menor costo",
      author: AUTHOR,
    });

    assert.equal(r.promoted.length, 1);
    assert.equal(r.promoted[0]!.id, "C-001");
    assert.equal(r.decision.id, "DEC-001");
    assert.match(r.decision.rationale, /menor costo/);

    const spec = await readSpec(root, id);
    assert.equal(spec.current_stage, "diseno");
    assert.equal(spec.concepts.length, 1);
    assert.equal(spec.decisions.length, 1);
    assert.equal(spec.version, 3); // NO sube versión

    // concepts.yaml consumido
    assert.deepEqual(await readConcepts(root, id), []);

    const audit = await readAudit(root, id);
    assert.ok(audit.some((a) => a.action === "exploration.close"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("closeExploration bloquea si quedan conceptos propuestos sin resolver", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, approvedSpecWithJtbd(id));
    await runExploration(root, id, {
      runner: explorationStubN(2),
      author: AUTHOR,
    });
    await reviewConcept(root, id, "C-001", {
      status: "seleccionado",
      actor: "Hugo",
    });
    // C-002 sigue propuesto → bloquea
    await assert.rejects(
      () =>
        closeExploration(root, id, {
          by: "Hugo",
          rationale: "x",
          author: AUTHOR,
        }),
      /no se puede cerrar|triage incompleto/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("closeExploration exige rationale (invariante 7)", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, approvedSpecWithJtbd(id));
    await runExploration(root, id, {
      runner: explorationStubN(1),
      author: AUTHOR,
    });
    await reviewConcept(root, id, "C-001", {
      status: "seleccionado",
      actor: "Hugo",
    });
    await assert.rejects(
      () =>
        closeExploration(root, id, { by: "Hugo", rationale: "  ", author: AUTHOR }),
      /rationale|invariante 7/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ─── P5: el feedback de la compuerta no se contamina con agent.proposed de otras etapas ──

test("runDefinition toma el feedback aunque haya un agent.proposed de agent3 intercalado", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, approvedSpecWithJtbd(id));
    await writeFindings(root, id, [finding("F-001", "t")]);

    // Secuencia que confundía al buscador: agent2 propuso → humano pidió iterar (feedback) →
    // agent3 propuso conceptos (otra etapa). El feedback debe sobrevivir al agent.proposed de agent3.
    await appendAudit(root, {
      actor: "agent2",
      action: "agent.proposed",
      spec_id: id,
      reason: "definición previa",
    });
    await appendAudit(root, {
      actor: "Hugo",
      action: "gate.iterate",
      spec_id: id,
      reason: "FEEDBACK-XYZ: agregar métrica de tiempo",
    });
    await appendAudit(root, {
      actor: "agent3",
      action: "agent.proposed",
      spec_id: id,
      reason: "conceptos de exploración",
    });

    let captured: string | undefined;
    const capturingRunner: DefinitionRunner = {
      async run(current, findings, feedback) {
        captured = feedback;
        return definitionStub().run(current, findings, feedback);
      },
    };

    await runDefinition(root, id, { runner: capturingRunner, author: AUTHOR });
    assert.match(captured ?? "", /FEEDBACK-XYZ/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ─── resolveTopic (P0): el topic se deriva de la spec, no de una constante ───────

test("resolveTopic usa la researchQuestion del intake cuando existe", () => {
  const spec: Spec = {
    ...createSpecV0({ id: "x", title: "Título de la spec" }),
    intake: {
      researchQuestion: "¿Por qué abandonan en el paso de pago?",
      hypotheses: [],
      productContext: null,
      discoveryPlan: { methods: [], instruments: [], expectedSourceKinds: [] },
    },
  };
  assert.equal(resolveTopic(spec), "¿Por qué abandonan en el paso de pago?");
});

test("resolveTopic cae al título de la spec sin intake", () => {
  const spec = createSpecV0({ id: "x", title: "Reducir abandono OTP" });
  assert.equal(resolveTopic(spec), "Reducir abandono OTP");
});

// ─── discoverPreflight (P2): costo estimado cache-aware, sin gastar tokens ────────

test("discoverPreflight cuenta texto/tabular y detecta cache hits", async () => {
  const { root, id } = await tempRepoWithSpec();
  try {
    await writeSpec(root, approvedSpecWithJtbd(id));
    const topic = resolveTopic(await readSpec(root, id));

    // fallback con 1 texto (en entrevistasDir) + 1 tabular (funnelCsv aparte, no en el dir)
    const fallbackDir = join(root, "fallback");
    await mkdir(fallbackDir, { recursive: true });
    const txt = join(fallbackDir, "entrevista.txt");
    const csv = join(root, "funnel.csv");
    await writeFile(txt, "una cita de prueba sobre el OTP", "utf8");
    await writeFile(csv, "step,count\nload,100\n", "utf8");

    // sembrar el cache de evidencia para el .txt bajo el topic de la spec
    const cacheDir = join(root, "specs", id, "evidence-cache");
    const sha = await computeFileSha256(txt);
    await writeEvidenceCache(
      cacheDir,
      sha,
      topic,
      [{ source: "entrevista.txt", locator: "p1", quote: "una cita" }],
      { source: "entrevista.txt", model: "test", extractedAt: "2026-01-01T00:00:00Z" },
    );

    const pf = await discoverPreflight(root, id, {
      entrevistasDir: fallbackDir,
      funnelCsv: csv,
    });

    assert.equal(pf.tabular, 1); // el .csv no gasta tokens
    assert.equal(pf.textSources, 1); // el .txt
    assert.equal(pf.cached, 1); // ya en cache → 0 tokens de extracción
    assert.equal(pf.toExtract, 0);
    assert.equal(pf.fromSamples, true);
    assert.equal(pf.alreadyRan, false); // sin findings.yaml
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
