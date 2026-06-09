// Genera el set de muestra SINTÉTICO del Agente 1 (Fase 1, paso 1.1).
// Determinista (sin aleatoriedad) → reproducible. Reemplazar por archivos reales después.
//
//   node scripts/gen-samples.mjs
//
// Produce: entrevistas (.txt/.pdf), analítica (.csv/.xlsx con drop-off OTP computable),
// tickets (.csv). Tema: abandono en la verificación OTP del onboarding.

import { mkdir, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

import xlsx from "xlsx";
import PDFDocument from "pdfkit";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = join(ROOT, "samples");

// ---------- entrevistas (cualitativo: citas textuales) ----------

const ENTREVISTA_01 = `Entrevista 01 — Usuario nuevo (iOS)
Fecha: 2026-05-12 · Moderador: equipo de research

P: Contame cómo fue tu primera vez abriendo la cuenta.
R: Bajé la app, puse mis datos y todo bien hasta que llegó el paso del código.

P: ¿Qué pasó en ese paso?
R: Me cansé de esperar el código y cerré la app. Llegó como tres minutos después, cuando ya había abandonado.

P: ¿Lo intentaste de nuevo?
R: Sí, pero a la segunda me pidió el código otra vez y tampoco llegaba rápido. Sentí que perdía el tiempo.

P: ¿Algo más que recuerdes de ese momento?
R: No sabía si el código había sido enviado o no. La pantalla no decía nada, solo un campo vacío esperando.
`;

const ENTREVISTA_02 = `Entrevista 02 — Usuaria recurrente (Android)
Fecha: 2026-05-14 · Moderador: equipo de research

P: ¿Tuviste algún problema al reingresar?
R: El SMS con el código siempre demora un montón en mi teléfono, a veces no llega.

P: ¿Y qué hacés cuando no llega?
R: Pido reenviar, pero el botón de reenviar recién se activa después de un rato largo. Eso me desespera.

P: ¿Llegaste a completar la verificación?
R: Esa vez no. Me rendí y entré desde la web más tarde. Si pudiera elegir otro método, usaría la huella.
`;

const ENTREVISTA_03 = `Entrevista 03 — Usuario nuevo (Android)
Fecha: 2026-05-16 · Moderador: equipo de research

P: ¿Cómo describirías el paso de verificación por código?
R: Confuso. No me quedaba claro a qué número iba a llegar el SMS ni cuánto debía esperar.

P: ¿Qué te hubiera ayudado?
R: Que me dijeran "te enviamos el código al número terminado en 45" y un contador. Esa incertidumbre me hizo dudar de la app.

P: ¿Abandonaste el registro?
R: Casi. Lo dejé a medias y volví al día siguiente porque necesitaba la cuenta, pero si no la hubiera necesitado, no vuelvo.
`;

// ---------- analítica (cuantitativo: se COMPUTA, no se estima) ----------

function buildFunnelRows() {
  const rows = [];
  const segmentos = ["nuevo", "recurrente"];
  const canales = ["ios", "android", "web"];
  const N = 350;
  for (let i = 1; i <= N; i++) {
    const llego = i % 10 !== 0 ? 1 : 0; // ~90% llega al paso OTP
    let completo = 0;
    let reintentos = 0;
    let espera = 0;
    if (llego) {
      const abandona = i % 100 < 38; // ~38% de los que llegan, abandonan
      completo = abandona ? 0 : 1;
      reintentos = abandona ? 1 + (i % 3) : i % 2;
      espera = abandona ? 45 + (i % 60) : 8 + (i % 20);
    }
    rows.push({
      session_id: `S-${String(i).padStart(4, "0")}`,
      fecha: `2026-05-${String((i % 28) + 1).padStart(2, "0")}`,
      segmento: segmentos[i % 2],
      canal: canales[i % 3],
      llego_a_otp: llego,
      completo_otp: completo,
      reintentos_otp: reintentos,
      tiempo_espera_seg: espera,
    });
  }
  return rows;
}

// ---------- tickets de soporte (texto dentro de tabular) ----------

const TICKETS = [
  ["no me llega el código de verificación", "alta"],
  ["el SMS con el código demora demasiado", "alta"],
  ["pedí reenviar el código y el botón estaba bloqueado", "media"],
  ["el código llegó vencido, no me sirvió", "alta"],
  ["no sé a qué número llega el SMS de verificación", "media"],
  ["quiero verificar con huella en vez de código", "baja"],
  ["la app se cerró esperando el código OTP", "media"],
  ["ingresé el código y me dijo que era incorrecto", "alta"],
  ["el contador para reenviar nunca termina", "media"],
  ["no puedo completar el registro por el código", "alta"],
  ["recibí el código dos veces y me confundí", "baja"],
  ["el SMS llegó 4 minutos tarde", "media"],
];

function buildTicketRows() {
  const categorias = ["onboarding", "verificacion", "acceso"];
  return TICKETS.map((t, idx) => {
    const i = idx + 1;
    return {
      ticket_id: `T-${String(i).padStart(3, "0")}`,
      fecha: `2026-05-${String((i % 28) + 1).padStart(2, "0")}`,
      categoria: categorias[i % 3],
      prioridad: t[1],
      canal: ["ios", "android", "web"][i % 3],
      descripcion: t[0],
    };
  });
}

// ---------- escritura ----------

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(","));
  return lines.join("\n") + "\n";
}

async function writePdf(path, title, paragraphs) {
  const doc = new PDFDocument({ margin: 56 });
  const stream = createWriteStream(path);
  doc.pipe(stream);
  doc.fontSize(15).text(title);
  doc.moveDown();
  for (const p of paragraphs) {
    doc.fontSize(11).text(p);
    doc.moveDown(0.6);
  }
  doc.end();
  await once(stream, "finish");
}

async function main() {
  await mkdir(join(SAMPLES, "entrevistas"), { recursive: true });
  await mkdir(join(SAMPLES, "analitica"), { recursive: true });
  await mkdir(join(SAMPLES, "tickets"), { recursive: true });

  // entrevistas .txt
  await writeFile(
    join(SAMPLES, "entrevistas", "entrevista-01.txt"),
    ENTREVISTA_01,
    "utf8",
  );
  await writeFile(
    join(SAMPLES, "entrevistas", "entrevista-02.txt"),
    ENTREVISTA_02,
    "utf8",
  );

  // entrevista .pdf (texto extraíble con locator de página/párrafo)
  await writePdf(
    join(SAMPLES, "entrevistas", "entrevista-03.pdf"),
    "Entrevista 03 — Usuario nuevo (Android) · 2026-05-16",
    ENTREVISTA_03.split("\n\n")
      .map((p) => p.trim())
      .filter(Boolean),
  );

  // analítica .csv + .xlsx
  const funnel = buildFunnelRows();
  await writeFile(
    join(SAMPLES, "analitica", "funnel-otp.csv"),
    toCsv(funnel),
    "utf8",
  );
  const ws = xlsx.utils.json_to_sheet(funnel);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "funnel");
  xlsx.writeFile(wb, join(SAMPLES, "analitica", "funnel-otp.xlsx"));

  // tickets .csv
  await writeFile(
    join(SAMPLES, "tickets", "tickets-soporte.csv"),
    toCsv(buildTicketRows()),
    "utf8",
  );

  // resumen (para chequeo rápido)
  const reached = funnel.filter((r) => r.llego_a_otp === 1).length;
  const abandoned = funnel.filter(
    (r) => r.llego_a_otp === 1 && r.completo_otp === 0,
  ).length;
  console.log(`entrevistas: 2 txt + 1 pdf`);
  console.log(
    `funnel: ${funnel.length} sesiones, llegaron a OTP=${reached}, abandonaron=${abandoned}`,
  );
  console.log(
    `drop-off OTP = ${((abandoned / reached) * 100).toFixed(1)}% (n=${reached})`,
  );
  console.log(`tickets: ${buildTicketRows().length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
