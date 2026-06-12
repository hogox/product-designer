import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ingestText,
  ingestPdf,
  ingestCsv,
  ingestXlsx,
  ingestDir,
  filterSegments,
  type TextSegment,
  type TextDocument,
  type TabularDocument,
} from "./index.js";

const seg = (text: string, index = 0): TextSegment => ({
  index,
  locator: `párrafo ${index + 1}`,
  text,
});

// ---------- filterSegments ----------

test("filterSegments: descarta segmentos trivialmente cortos (< 30 chars)", () => {
  const segments = [
    seg("1", 0),
    seg("Página 2", 1),
    seg("---", 2),
    seg("Este es un segmento largo con información útil para el análisis.", 3),
  ];
  const result = filterSegments(segments);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.index, 3);
});

test("filterSegments: dedup exacto — mantiene el primero, descarta duplicados", () => {
  const text = "El usuario no pudo completar el flujo de onboarding correctamente.";
  const segments = [seg(text, 0), seg(text, 1), seg(text, 2)];
  const result = filterSegments(segments);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.index, 0);
});

test("filterSegments: dedup normaliza mayúsculas y espacios extra", () => {
  const a = "El usuario tuvo problemas con el código OTP durante la sesión.";
  const b = "el   usuario tuvo problemas con el código OTP durante la sesión.";
  const result = filterSegments([seg(a, 0), seg(b, 1)]);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.locator, "párrafo 1"); // preserva locator original
});

test("filterSegments: segmentos distintos pasan todos", () => {
  const segments = [
    seg("El usuario no pudo completar el flujo de registro en la app.", 0),
    seg("La pantalla de confirmación tardó más de 10 segundos en cargar.", 1),
    seg("El soporte tardó 3 días en responder la consulta del usuario.", 2),
  ];
  const result = filterSegments(segments);
  assert.equal(result.length, 3);
});

test("filterSegments: lista vacía → resultado vacío", () => {
  assert.deepEqual(filterSegments([]), []);
});

// dist/ingest.test.js → repo root (packages/agent1/dist → ../../..)
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SAMPLES = join(REPO, "samples");

test("ingestText: entrevista .txt → párrafos con locator y cita verificable", async () => {
  const doc = await ingestText(
    join(SAMPLES, "entrevistas", "entrevista-01.txt"),
  );
  assert.equal(doc.kind, "text");
  assert.equal(doc.source, "entrevista-01.txt");
  assert.ok(doc.segments.length > 0);
  // locator de párrafo bien formado
  assert.match(doc.segments[0]!.locator, /^párrafo \d+$/);
  // la cita textual existe en algún segmento (base de la verificación del paso 1.4)
  const quote = "Me cansé de esperar el código y cerré la app";
  assert.ok(doc.segments.some((s) => s.text.includes(quote)));
  assert.ok(doc.fullText.includes(quote));
});

test("ingestPdf: entrevista .pdf → bloques con locator de página", async () => {
  const doc: TextDocument = await ingestPdf(
    join(SAMPLES, "entrevistas", "entrevista-03.pdf"),
  );
  assert.equal(doc.kind, "text");
  assert.ok(doc.segments.length > 0);
  assert.match(doc.segments[0]!.locator, /^p\.\d+, bloque \d+$/);
  // contenido extraído (texto del PDF generado)
  assert.ok(doc.fullText.includes("Confuso"));
});

test("ingestCsv: funnel-otp.csv → tabular con 350 filas y columnas correctas", async () => {
  const doc: TabularDocument = await ingestCsv(
    join(SAMPLES, "analitica", "funnel-otp.csv"),
  );
  assert.equal(doc.kind, "tabular");
  assert.equal(doc.sheet, "csv");
  assert.equal(doc.rows.length, 350);
  assert.ok(doc.columns.includes("llego_a_otp"));
  assert.ok(doc.columns.includes("completo_otp"));
  // dynamicTyping: numéricos quedan como number
  assert.equal(typeof doc.rows[0]!.llego_a_otp, "number");
});

test("ingestCsv: respeta comas dentro de campos citados", async () => {
  const doc = await ingestCsv(join(SAMPLES, "tickets", "tickets-soporte.csv"));
  const row = doc.rows.find((r) => r.ticket_id === "T-004");
  assert.ok(row);
  // la descripción con coma se preserva como un solo campo
  assert.equal(row!.descripcion, "el código llegó vencido, no me sirvió");
});

test("ingestXlsx: funnel-otp.xlsx → hoja 'funnel' con 350 filas", async () => {
  const docs = await ingestXlsx(join(SAMPLES, "analitica", "funnel-otp.xlsx"));
  assert.equal(docs.length, 1);
  const doc = docs[0]!;
  assert.equal(doc.sheet, "funnel");
  assert.equal(doc.rows.length, 350);
  assert.ok(doc.columns.includes("tiempo_espera_seg"));
});

test("ingestDir: recolecta todo el set (texto + tabular)", async () => {
  const docs = await ingestDir(SAMPLES);
  const texts = docs.filter((d) => d.kind === "text");
  const tabular = docs.filter((d) => d.kind === "tabular");
  assert.ok(texts.length >= 3); // 2 txt + 1 pdf
  assert.ok(tabular.length >= 3); // csv funnel + xlsx funnel + csv tickets
});
