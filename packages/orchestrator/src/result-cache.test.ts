import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  hashResultInputs,
  readResultCache,
  writeResultCache,
  cachedModelCall,
} from "./result-cache.js";

test("hashResultInputs: hash estable para los mismos inputs", () => {
  const h1 = hashResultInputs({ kind: "derive", model: "claude-opus-4-8", inputs: { topic: "OTP" } });
  const h2 = hashResultInputs({ kind: "derive", model: "claude-opus-4-8", inputs: { topic: "OTP" } });
  assert.equal(h1, h2);
  assert.equal(typeof h1, "string");
  assert.ok(h1.length === 64); // sha256 hex
});

test("hashResultInputs: hash distinto para inputs diferentes", () => {
  const h1 = hashResultInputs({ kind: "derive", inputs: { topic: "OTP" } });
  const h2 = hashResultInputs({ kind: "derive", inputs: { topic: "OTP2" } });
  assert.notEqual(h1, h2);
});

test("readResultCache: miss si el archivo no existe", async () => {
  const result = await readResultCache<unknown>("/no/existe", "derive", "aabbccdd");
  assert.equal(result, null);
});

test("writeResultCache + readResultCache: round-trip correcto", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pda-rc-test-"));
  try {
    const hash = hashResultInputs({ x: 42 });
    const payload = { findings: ["F-001"] };
    await writeResultCache(dir, "derive", hash, payload, {
      model: "claude-opus-4-8",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const cached = await readResultCache<typeof payload>(dir, "derive", hash);
    assert.deepEqual(cached, payload);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("readResultCache: null si el hash no coincide (archivo corrupto)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pda-rc-test-"));
  try {
    const hash = hashResultInputs({ x: 1 });
    await writeResultCache(dir, "define", hash, { ok: true }, {
      model: "m",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    // hash distinto al leer → miss
    const wrongHash = hashResultInputs({ x: 2 });
    const result = await readResultCache(dir, "define", wrongHash);
    assert.equal(result, null);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("cachedModelCall: hit no llama a call()", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pda-rc-test-"));
  try {
    const inputs = { topic: "OTP" };
    const model = "claude-opus-4-8";
    const hash = hashResultInputs({ kind: "define", model, inputs });
    await writeResultCache(dir, "define", hash, { cached: true }, {
      model,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    let called = false;
    const { payload, fromCache } = await cachedModelCall({
      cacheDir: dir,
      kind: "define",
      model,
      inputs,
      call: async () => {
        called = true;
        return { cached: false };
      },
    });

    assert.equal(fromCache, true);
    assert.equal(called, false);
    assert.deepEqual(payload, { cached: true });
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("cachedModelCall: miss llama a call() y persiste", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pda-rc-test-"));
  try {
    let callCount = 0;
    const { payload, fromCache } = await cachedModelCall({
      cacheDir: dir,
      kind: "explore",
      model: "claude-opus-4-8",
      inputs: { topic: "nuevo" },
      call: async () => {
        callCount++;
        return { fresh: true };
      },
    });

    assert.equal(fromCache, false);
    assert.equal(callCount, 1);
    assert.deepEqual(payload, { fresh: true });

    // segunda llamada → hit
    const { fromCache: hit } = await cachedModelCall({
      cacheDir: dir,
      kind: "explore",
      model: "claude-opus-4-8",
      inputs: { topic: "nuevo" },
      call: async () => {
        callCount++;
        return { fresh: false };
      },
    });
    assert.equal(hit, true);
    assert.equal(callCount, 1); // no se llamó de nuevo
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("cachedModelCall: noCache=true fuerza call() aunque haya hit", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pda-rc-test-"));
  try {
    const inputs = { x: 1 };
    const model = "m";
    const hash = hashResultInputs({ kind: "derive", model, inputs });
    await writeResultCache(dir, "derive", hash, { v: 1 }, {
      model,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    let called = false;
    const { fromCache } = await cachedModelCall({
      cacheDir: dir,
      noCache: true,
      kind: "derive",
      model,
      inputs,
      call: async () => {
        called = true;
        return { v: 2 };
      },
    });

    assert.equal(fromCache, false);
    assert.equal(called, true);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("cachedModelCall: sin cacheDir va directo al modelo", async () => {
  let called = false;
  const { payload, fromCache } = await cachedModelCall({
    kind: "derive",
    model: "m",
    inputs: {},
    call: async () => {
      called = true;
      return 42;
    },
  });
  assert.equal(fromCache, false);
  assert.equal(called, true);
  assert.equal(payload, 42);
});
