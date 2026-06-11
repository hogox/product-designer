import { test } from "node:test";
import assert from "node:assert/strict";

import {
  startAgentJob,
  getJob,
  isRunning,
  jobView,
  isAgentName,
  JobConflictError,
} from "./agentJobs.ts";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("isAgentName valida los nombres conocidos", () => {
  assert.equal(isAgentName("discover"), true);
  assert.equal(isAgentName("define"), true);
  assert.equal(isAgentName("explore"), true);
  assert.equal(isAgentName("nope"), false);
});

test("jobView devuelve idle si no hay job", () => {
  assert.deepEqual(jobView(getJob("sin-job", "explore")), { status: "idle" });
});

test("startAgentJob: corre, bloquea la re-corrida (409) y completa con tokens", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });

  const job = startAgentJob("s1", "discover", "Hugo", async () => {
    await gate;
    return {
      result: { agent: "discover", counts: { hallazgos: 3 } },
      tokens: { input: 10, output: 5, total: 15, cacheHits: 2 },
    };
  });
  assert.equal(job.status, "running");
  assert.equal(isRunning("s1", "discover"), true);

  // segundo disparo del MISMO (spec, agente) mientras corre → conflicto (lock)
  assert.throws(
    () =>
      startAgentJob("s1", "discover", "Hugo", async () => ({
        result: { agent: "discover", counts: {} },
      })),
    JobConflictError,
  );

  // otro agente en la misma spec NO está bloqueado
  assert.equal(isRunning("s1", "define"), false);

  release();
  await tick();

  const done = getJob("s1", "discover");
  assert.equal(done?.status, "done");
  assert.equal(done?.result?.counts.hallazgos, 3);
  assert.equal(done?.tokens?.total, 15);
  assert.equal(done?.tokens?.cacheHits, 2);
});

test("startAgentJob: captura errores del fn en status error", async () => {
  startAgentJob("s2", "define", "Hugo", async () => {
    throw new Error("boom en la corrida");
  });
  await tick();
  const j = getJob("s2", "define");
  assert.equal(j?.status, "error");
  assert.match(j?.error ?? "", /boom/);
});
