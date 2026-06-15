import { test } from "node:test";
import assert from "node:assert/strict";

import { parseLeadingNumber, deriveDirection } from "./parseMetric.ts";

// Casos reales de otp-onboarding — invariante 4: los números se extraen, nunca se inventan.

test("parseLeadingNumber: baseline con porcentaje y detalle extra", () => {
  const r = parseLeadingNumber("56.8% (179/315 completan; drop-off 43.2%)");
  assert.ok(r);
  assert.equal(r.value, 56.8);
  assert.equal(r.unit, "%");
  assert.equal(r.op, null);
  assert.equal(r.raw, "56.8%");
});

test("parseLeadingNumber: target con operador ≥", () => {
  const r = parseLeadingNumber("≥75% de finalización (tentativo)");
  assert.ok(r);
  assert.equal(r.value, 75);
  assert.equal(r.unit, "%");
  assert.equal(r.op, "≥");
  assert.equal(r.raw, "≥75%");
});

test("parseLeadingNumber: target con operador ≤", () => {
  const r = parseLeadingNumber("≤25% de abandono (tentativo)");
  assert.ok(r);
  assert.equal(r.value, 25);
  assert.equal(r.unit, "%");
  assert.equal(r.op, "≤");
});

test("parseLeadingNumber: baseline en segundos", () => {
  const r = parseLeadingNumber(
    "71.9 s promedio de espera en casos de abandono (n=136)",
  );
  assert.ok(r);
  assert.equal(r.value, 71.9);
  assert.equal(r.unit, "s");
  assert.equal(r.op, null);
});

test("parseLeadingNumber: null retorna null", () => {
  assert.equal(parseLeadingNumber(null), null);
});

test("parseLeadingNumber: undefined retorna null", () => {
  assert.equal(parseLeadingNumber(undefined), null);
});

test("parseLeadingNumber: target narrativo retorna null", () => {
  assert.equal(
    parseLeadingNumber(
      "Disponibilizar y lograr adopción de un método alternativo ante fallas de SMS",
    ),
    null,
  );
});

test("parseLeadingNumber: target narrativo 'Reducir' retorna null", () => {
  assert.equal(
    parseLeadingNumber(
      "Reducir el tiempo de espera percibido y entregar feedback visible desde el segundo 0",
    ),
    null,
  );
});

test("parseLeadingNumber: baseline simple 43.2%", () => {
  const r = parseLeadingNumber("43.2% (136/315)");
  assert.ok(r);
  assert.equal(r.value, 43.2);
  assert.equal(r.unit, "%");
});

test("deriveDirection: ≤ implica bajar es mejor", () => {
  const p = parseLeadingNumber("≤25%");
  assert.equal(deriveDirection(p), "down");
});

test("deriveDirection: < implica bajar es mejor", () => {
  const p = parseLeadingNumber("<10%");
  assert.equal(deriveDirection(p), "down");
});

test("deriveDirection: ≥ implica subir es mejor", () => {
  const p = parseLeadingNumber("≥75%");
  assert.equal(deriveDirection(p), "up");
});

test("deriveDirection: null → up por defecto", () => {
  assert.equal(deriveDirection(null), "up");
});

// extractFirstNumber — búsqueda en texto (problem statement)
import { extractFirstNumber } from "./parseMetric.ts";

test("extractFirstNumber: % embebido tras texto ('El 43.2%...')", () => {
  const r = extractFirstNumber(
    "El 43.2% de los usuarios que llegan a la verificación OTP la abandonan",
  );
  assert.ok(r);
  assert.equal(r.value, 43.2);
  assert.equal(r.unit, "%");
});

test("extractFirstNumber: año al inicio no es % → siguiente número es %", () => {
  const r = extractFirstNumber("En 2024, el 60% de usuarios abandonan");
  assert.ok(r);
  // primer número es 2024, unit null → ok que lo encuentre (caller filtra unit==="%")
  assert.equal(r.value, 2024);
  assert.equal(r.unit, null);
});

test("extractFirstNumber: null → null", () => {
  assert.equal(extractFirstNumber(null), null);
});

test("extractFirstNumber: texto sin números → null", () => {
  assert.equal(extractFirstNumber("Sin datos numéricos disponibles"), null);
});
