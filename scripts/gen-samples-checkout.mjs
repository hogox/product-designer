// Genera el set sintético de la DEMO (Sesión 18): caída en checkout (producto Pagos).
// Determinista (sin aleatoriedad) → reproducible. Diseñado para que las 4 hipótesis del
// intake de `caida-en-checkout` sean confirmables/refutables con evidencia anclada:
//   H1 fricción de pasos/campos · H2 errores técnicos/rechazos · H3 desconfianza/cargos
//   poco claros · H4 métodos de pago ausentes.
//
//   node scripts/gen-samples-checkout.mjs
//
// Produce en samples-checkout/ (para subir desde la UI de Fuentes en la demo):
//   entrevistas/ (3 txt + 1 pdf) · personas/ (2 txt) · analitica/funnel-checkout.csv+.xlsx
//   encuestas/nps-post-compra.csv + ces-checkout.csv · tickets/tickets-pagos.csv
//   benchmark/benchmark-checkouts.txt
//
// Números computables (invariante 4 — el Agente 1 los COMPUTA con computeTabularMetrics):
//   drop-off pago = 38.0% (152/400) · nuevo 47.0% vs recurrente 29.0%
//   tasa de error_pago = 15.0% (60/400) · tiempo_checkout_seg medio en abandonos ≈ 190 s
//   NPS = −10 (30 promotores / 48 pasivos / 42 detractores, n=120) · CES promedio = 4.9 (n=80)
//   categoría dominante de tickets: error_pago

import { mkdir, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

import xlsx from "xlsx";
import PDFDocument from "pdfkit";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "samples-checkout");

// ---------- entrevistas (cualitativo: citas textuales anclables) ----------

const ENTREVISTA_01 = `Entrevista 01 — Compradora nueva (móvil, Android)
Fecha: 2026-06-02 · Moderador: equipo de research

P: Contame la última vez que intentaste comprar y no terminaste.
R: Tenía el producto en el carrito y cuando fui a pagar me pidieron crear una cuenta, confirmar el mail, y recién ahí empezar a cargar la tarjeta. Lo dejé para después y nunca volví.

P: ¿Qué parte se te hizo más pesada?
R: El formulario. Me pidió la dirección de facturación completa aunque era un producto digital. Eran como veinte campos y yo estaba en el colectivo, desde el teléfono.

P: ¿Llegaste a ver el monto final?
R: No, justamente. Quería ver cuánto quedaba con el envío antes de poner la tarjeta, y el total recién aparecía al final de todo.

P: Si pudieras cambiar una sola cosa, ¿cuál sería?
R: Poder pagar como invitada. No quiero crear una cuenta para comprar una sola vez.
`;

const ENTREVISTA_02 = `Entrevista 02 — Comprador recurrente (web, escritorio)
Fecha: 2026-06-03 · Moderador: equipo de research

P: ¿Tuviste problemas pagando en el último mes?
R: Dos veces. La tarjeta me la rechazó sin decirme por qué. Solo un cartel rojo que decía "no pudimos procesar tu pago, intentá de nuevo".

P: ¿Y qué hiciste?
R: Lo intenté de nuevo con la misma tarjeta y nada. Después probé con otra y pasó. Pero me quedé con la duda de si me cobraron dos veces.

P: ¿Volviste a comprar después de eso?
R: Sí, pero ahora pago por transferencia cuando puedo. Le tengo menos confianza al checkout con tarjeta.

P: ¿El error te explicó algo en algún momento?
R: Nada. Ni el motivo ni qué hacer distinto. Si me hubiera dicho "tu banco rechazó la operación, probá con otra tarjeta", me ahorraba diez minutos.
`;

const ENTREVISTA_03 = `Entrevista 03 — Compradora ocasional (móvil, iOS)
Fecha: 2026-06-05 · Moderador: equipo de research

P: ¿Qué te genera dudas a la hora de pagar online?
R: Los cargos que aparecen al final. En esta app el precio del producto era uno, y en el último paso aparecieron un cargo por servicio y otro por procesamiento que nadie me había mostrado.

P: ¿Y eso qué te hizo hacer?
R: Cerré la app. Me sentí estafada, aunque capaz eran cargos normales. Si me los mostraban desde el principio, lo pensaba distinto.

P: ¿Qué señales te dan confianza en un checkout?
R: Ver el desglose completo antes de poner la tarjeta, el candadito, y que la página no parezca armada a las apuradas. Acá el paso del pago tenía otro diseño que el resto de la app, parecía de otra empresa.

P: ¿Completaste la compra finalmente?
R: En otro lado. Mismo producto, un poco más caro, pero me mostraron el total desde el primer paso.
`;

const ENTREVISTA_04 = `Entrevista 04 — Comprador joven (móvil, Android)
Fecha: 2026-06-06 · Moderador: equipo de research

P: ¿Cómo pagás normalmente tus compras online?
R: Con la billetera virtual, casi siempre. No uso tarjeta de crédito, no tengo.

P: ¿Qué pasó cuando quisiste pagar en nuestra app?
R: Solo aceptaba tarjeta de crédito o débito. Mi débito no pasó y no había opción de billetera ni de pagar en efectivo en un punto de pago. Ahí murió la compra.

P: ¿Eso te pasa seguido?
R: Sí, y es un filtro directo. Si no veo mi billetera entre los medios de pago, ni cargo los datos. Me fijo eso antes que el precio del envío.

P: ¿Qué medios esperás encontrar siempre?
R: Billetera virtual, transferencia y algún pago en efectivo. La tarjeta sola no alcanza, por lo menos para la gente de mi edad.
`;

// ---------- personas (documentos de research previos, citables) ----------

const PERSONA_01 = `Persona — "Carla, la compradora móvil apurada"
Documento de research · Producto Pagos · 2026-05

Perfil: 32 años, trabaja tiempo completo, compra desde el teléfono en momentos muertos
(transporte, filas, pausas). El 85% de sus sesiones de compra duran menos de cinco minutos.

Objetivo principal: completar la compra en una sola sesión corta, sin crear cuentas nuevas
ni cargar formularios largos desde el teclado del teléfono.

Frustraciones: formularios con muchos campos en pantallas chicas, obligación de registrarse
para comprar una sola vez, y no ver el costo total con envío hasta el final del flujo.

Comportamiento clave: si el checkout le pide más de dos pantallas de datos, abandona y deja
el carrito "para después", pero rara vez vuelve. Prefiere autocompletar y pago como invitada.

Cita representativa: "si me hacés crear una cuenta y confirmar el mail para pagar, ya fue,
lo dejo para después y después no existe".
`;

const PERSONA_02 = `Persona — "Diego, el comprador desconfiado del pago online"
Documento de research · Producto Pagos · 2026-05

Perfil: 47 años, compra online hace años pero tuvo una experiencia de doble cobro que lo
marcó. Revisa cada paso del pago y abandona ante la primera señal confusa.

Objetivo principal: pagar con la certeza de cuánto se le va a cobrar, por qué medio, y tener
comprobante inmediato de la operación.

Frustraciones: cargos por servicio que aparecen recién en el último paso, mensajes de error
genéricos que no explican si el cobro se hizo o no, y pantallas de pago con un diseño
distinto al resto del sitio (le parecen fraudulentas).

Comportamiento clave: ante un error de pago sin explicación, no reintenta: se va a otro
comercio o paga por transferencia bancaria. Valora el desglose de cargos visible desde el
primer paso del checkout.

Cita representativa: "cuando el cartel rojo no me dice qué pasó con mi plata, para mí ya es
un problema del comercio, no mío".
`;

// ---------- benchmark (texto citable) ----------

const BENCHMARK = `Benchmark de checkouts — comparativa rápida de 4 competidores
Equipo de producto Pagos · 2026-06 · fuentes: flujos públicos auditados a mano

Competidor A (líder regional): checkout de una sola página con desglose de cargos visible
desde el primer paso. Permite pago como invitado y guarda los datos recién después de la
primera compra exitosa. Tres medios de pago: tarjeta, billetera virtual y transferencia.

Competidor B: flujo de tres pasos con barra de progreso. El total con impuestos y envío se
muestra fijo en un resumen lateral durante todo el flujo. Ante un rechazo de tarjeta muestra
el motivo informado por el banco y sugiere el siguiente paso ("probá con otra tarjeta o
pagá con transferencia").

Competidor C: requiere registro previo, similar a nuestro flujo actual. Es el de peor
conversión declarada del grupo según su propio reporte de resultados del último trimestre.

Competidor D: apuesta todo a billeteras: el 60% de sus transacciones entra por billetera
virtual según su reporte público. El alta de tarjeta existe pero está relegada a un segundo
nivel del menú de pago.

Lectura del equipo: los dos patrones que se repiten en los flujos con mejor conversión son
(1) total final visible desde el primer paso y (2) más de un medio de pago con la billetera
como primera opción. El registro obligatorio antes de pagar solo aparece en el peor del grupo.
`;

// ---------- analítica (cuantitativo: se COMPUTA, no se estima) ----------
// Números exactos por construcción:
//   400 sesiones llegan al paso de pago (de 500): drop-off pago = 152/400 = 38.0%
//   nuevo: 94/200 = 47.0% · recurrente: 58/200 = 29.0%
//   error_pago: 60/400 = 15.0% (48 en abandonos, 12 en completados)
//   tiempo_checkout_seg en abandonos ≈ 190 s · en completados ≈ 95 s

function buildFunnelRows() {
  const rows = [];
  const canales = ["ios", "android", "web"];
  let id = 0;

  const pushRow = (segmento, llego, completo, error, tiempo) => {
    id++;
    rows.push({
      sesion_id: `S-${String(id).padStart(4, "0")}`,
      fecha: `2026-06-${String((id % 28) + 1).padStart(2, "0")}`,
      segmento,
      canal: canales[id % 3],
      llego_a_pago: llego,
      completo_pago: completo,
      error_pago: error,
      tiempo_checkout_seg: tiempo,
    });
  };

  // nuevo: 200 llegan al pago, 94 abandonan (47.0%)
  for (let i = 0; i < 200; i++) {
    const abandona = i < 94;
    // 26 de los abandonos nuevo con error de pago; 6 completados con error (recuperados)
    const error = abandona ? (i < 26 ? 1 : 0) : i - 94 < 6 ? 1 : 0;
    const tiempo = abandona ? 160 + (i % 60) : 70 + (i % 50);
    pushRow("nuevo", 1, abandona ? 0 : 1, error, tiempo);
  }

  // recurrente: 200 llegan al pago, 58 abandonan (29.0%)
  for (let i = 0; i < 200; i++) {
    const abandona = i < 58;
    // 22 de los abandonos recurrente con error de pago; 6 completados con error
    const error = abandona ? (i < 22 ? 1 : 0) : i - 58 < 6 ? 1 : 0;
    const tiempo = abandona ? 175 + (i % 55) : 80 + (i % 40);
    pushRow("recurrente", 1, abandona ? 0 : 1, error, tiempo);
  }

  // 100 sesiones que no llegan al paso de pago (caen antes, en carrito/datos)
  for (let i = 0; i < 100; i++) {
    pushRow(i % 2 === 0 ? "nuevo" : "recurrente", 0, 0, 0, 0);
  }

  return rows;
}

// ---------- encuestas: NPS post-compra y CES del checkout ----------
// NPS: 30 promotores (25%) − 42 detractores (35%) sobre n=120 → NPS = −10
// CES (1=muy fácil, 7=muy difícil): suma 392 sobre n=80 → promedio 4.9

const NPS_COMENTARIOS = {
  promotor: [
    "rápido y sin vueltas, repetiría la compra",
    "me funcionó perfecto con tarjeta guardada",
    "fácil, aunque sumaría más medios de pago",
  ],
  pasivo: [
    "cumple, pero el formulario de pago es largo",
    "estuvo bien, me costó encontrar el total final",
    "ok, aunque tuve que reintentar una vez",
  ],
  detractor: [
    "me rechazó el pago dos veces sin explicación",
    "aparecieron cargos al final que no esperaba",
    "no estaba mi billetera para pagar, casi no compro",
    "demasiados pasos para pagar desde el teléfono",
  ],
};

function buildNpsRows() {
  const rows = [];
  const segmentos = ["nuevo", "recurrente"];
  let id = 0;
  const add = (score, tipo, count) => {
    for (let i = 0; i < count; i++) {
      id++;
      const comentarios = NPS_COMENTARIOS[tipo];
      rows.push({
        respondente_id: `R-${String(id).padStart(3, "0")}`,
        fecha: `2026-06-${String((id % 28) + 1).padStart(2, "0")}`,
        segmento: segmentos[id % 2],
        nps: score,
        comentario: comentarios[id % comentarios.length],
      });
    }
  };
  add(10, "promotor", 14);
  add(9, "promotor", 16); // 30 promotores
  add(8, "pasivo", 26);
  add(7, "pasivo", 22); // 48 pasivos
  add(6, "detractor", 12);
  add(4, "detractor", 14);
  add(2, "detractor", 16); // 42 detractores
  return rows;
}

const CES_COMENTARIOS = [
  "muchos campos para cargar desde el celular",
  "tuve que crear cuenta para poder pagar",
  "el total recién se ve al final",
  "pagué sin problemas",
  "no encontré mi medio de pago",
  "el error de la tarjeta no decía qué hacer",
];

function buildCesRows() {
  // 80 respuestas: 7×14 + 6×20 + 5×16 + 4×12 + 3×10 + 2×8 = 392 → promedio 4.9 (esfuerzo alto)
  const rows = [];
  let id = 0;
  const add = (score, count) => {
    for (let i = 0; i < count; i++) {
      id++;
      rows.push({
        respondente_id: `C-${String(id).padStart(3, "0")}`,
        fecha: `2026-06-${String((id % 28) + 1).padStart(2, "0")}`,
        ces: score,
        comentario: CES_COMENTARIOS[id % CES_COMENTARIOS.length],
      });
    }
  };
  add(7, 14);
  add(6, 20);
  add(5, 16);
  add(4, 12);
  add(3, 10);
  add(2, 8);
  return rows;
}

// ---------- tickets de soporte (texto dentro de tabular + categoría computable) ----------

const TICKETS = [
  ["me rechazó la tarjeta sin decir el motivo", "error_pago", "alta"],
  ["el pago figura dos veces en mi resumen", "error_pago", "alta"],
  ["error al procesar el pago, reintenté y nada", "error_pago", "alta"],
  ["la app se colgó en el paso de la tarjeta", "error_pago", "media"],
  ["el pago quedó pendiente y no sé si se hizo", "error_pago", "alta"],
  ["me cobraron y no llegó el comprobante", "error_pago", "media"],
  ["el botón de pagar no respondía", "error_pago", "media"],
  ["apareció un cargo por servicio que no vi antes", "cargos", "alta"],
  ["el total final no coincide con el del carrito", "cargos", "alta"],
  ["quiero el desglose de los cargos del pago", "cargos", "baja"],
  ["no puedo pagar con mi billetera virtual", "metodos", "media"],
  ["no aceptan transferencia bancaria", "metodos", "media"],
  ["mi tarjeta de débito no está soportada", "metodos", "alta"],
  ["el formulario de pago me pide demasiados datos", "friccion", "baja"],
  ["tuve que crear una cuenta solo para pagar", "friccion", "media"],
];

function buildTicketRows() {
  return TICKETS.map((t, idx) => {
    const i = idx + 1;
    return {
      ticket_id: `T-${String(i).padStart(3, "0")}`,
      fecha: `2026-06-${String((i % 28) + 1).padStart(2, "0")}`,
      categoria: t[1],
      prioridad: t[2],
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
  for (const d of ["entrevistas", "personas", "analitica", "encuestas", "tickets", "benchmark"]) {
    await mkdir(join(OUT, d), { recursive: true });
  }

  // entrevistas (3 txt + 1 pdf)
  await writeFile(join(OUT, "entrevistas", "entrevista-01.txt"), ENTREVISTA_01, "utf8");
  await writeFile(join(OUT, "entrevistas", "entrevista-02.txt"), ENTREVISTA_02, "utf8");
  await writeFile(join(OUT, "entrevistas", "entrevista-03.txt"), ENTREVISTA_03, "utf8");
  await writePdf(
    join(OUT, "entrevistas", "entrevista-04.pdf"),
    "Entrevista 04 — Comprador joven (móvil, Android) · 2026-06-06",
    ENTREVISTA_04.split("\n\n").map((p) => p.trim()).filter(Boolean),
  );

  // personas
  await writeFile(join(OUT, "personas", "persona-compradora-movil.txt"), PERSONA_01, "utf8");
  await writeFile(join(OUT, "personas", "persona-comprador-desconfiado.txt"), PERSONA_02, "utf8");

  // benchmark
  await writeFile(join(OUT, "benchmark", "benchmark-checkouts.txt"), BENCHMARK, "utf8");

  // analítica .csv + .xlsx
  const funnel = buildFunnelRows();
  await writeFile(join(OUT, "analitica", "funnel-checkout.csv"), toCsv(funnel), "utf8");
  const ws = xlsx.utils.json_to_sheet(funnel);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "funnel");
  xlsx.writeFile(wb, join(OUT, "analitica", "funnel-checkout.xlsx"));

  // encuestas
  await writeFile(join(OUT, "encuestas", "nps-post-compra.csv"), toCsv(buildNpsRows()), "utf8");
  await writeFile(join(OUT, "encuestas", "ces-checkout.csv"), toCsv(buildCesRows()), "utf8");

  // tickets
  await writeFile(join(OUT, "tickets", "tickets-pagos.csv"), toCsv(buildTicketRows()), "utf8");

  // verificación interna de los números prometidos
  const reached = funnel.filter((r) => r.llego_a_pago === 1);
  const abandons = reached.filter((r) => r.completo_pago === 0);
  const errors = reached.filter((r) => r.error_pago === 1);
  const nps = buildNpsRows();
  const promot = nps.filter((r) => r.nps >= 9).length;
  const detrac = nps.filter((r) => r.nps <= 6).length;
  const ces = buildCesRows();
  const cesAvg = ces.reduce((a, r) => a + r.ces, 0) / ces.length;

  console.log(`✓ samples-checkout/ generado:`);
  console.log(`  funnel: drop-off pago = ${((abandons.length / reached.length) * 100).toFixed(1)}% (${abandons.length}/${reached.length})`);
  for (const seg of ["nuevo", "recurrente"]) {
    const rs = reached.filter((r) => r.segmento === seg);
    const as_ = rs.filter((r) => r.completo_pago === 0);
    console.log(`    segmento=${seg}: ${((as_.length / rs.length) * 100).toFixed(1)}% (${as_.length}/${rs.length})`);
  }
  console.log(`  tasa error_pago = ${((errors.length / reached.length) * 100).toFixed(1)}% (${errors.length}/${reached.length})`);
  console.log(`  NPS = ${(((promot - detrac) / nps.length) * 100).toFixed(0)} (P=${promot} D=${detrac} n=${nps.length})`);
  console.log(`  CES promedio = ${cesAvg.toFixed(1)} (n=${ces.length})`);
  console.log(`  docs: 4 entrevistas · 2 personas · 1 benchmark · 2 encuestas · 1 tickets · funnel csv+xlsx`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
