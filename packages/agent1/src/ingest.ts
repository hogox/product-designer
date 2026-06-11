// Paso "recolectar" del Agente 1: archivos crudos → corpus normalizado con LOCATORS.
// - Texto (txt/pdf): segmentos con cita textual + locator (párrafo / página+línea).
// - Tabular (csv/xlsx): filas + columnas; los locators de un cálculo (hoja/rango) se
//   construyen en el cómputo (paso 1.3). Aquí solo normalizamos.
//
// Invariante: la evidencia se ancla a su fuente. Por eso cada doc guarda `source` (archivo),
// los segmentos guardan `locator`, y el texto completo permite verificar citas (paso 1.4).

import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import Papa from "papaparse";
import { read as readXlsx, utils as xlsxUtils } from "xlsx";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface TextSegment {
  index: number; // 0-based dentro del documento
  locator: string; // p. ej. "párrafo 3" o "p.1, línea 5"
  text: string;
}

export interface TextDocument {
  kind: "text";
  source: string; // basename del archivo (lo que cita la evidencia)
  path: string;
  fullText: string; // todo el texto, para verificar que una cita existe (paso 1.4)
  segments: TextSegment[];
}

export type TabularValue = string | number | boolean | null;

export interface TabularDocument {
  kind: "tabular";
  source: string;
  path: string;
  sheet: string; // "csv" para CSV; nombre de hoja para XLSX
  columns: string[];
  rows: Record<string, TabularValue>[];
}

export type IngestedDocument = TextDocument | TabularDocument;

const TEXT_EXT = new Set([".txt", ".md"]);

// ---------- texto ----------

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

export async function ingestText(path: string): Promise<TextDocument> {
  const raw = await readFile(path, "utf8");
  const segments: TextSegment[] = paragraphs(raw).map((text, i) => ({
    index: i,
    locator: `párrafo ${i + 1}`,
    text,
  }));
  return {
    kind: "text",
    source: basename(path),
    path,
    fullText: raw,
    segments,
  };
}

async function readPdfPages(buffer: Buffer): Promise<string[]> {
  const data = new Uint8Array(buffer);
  const doc = await getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    let text = "";
    for (const item of tc.items) {
      if ("str" in item) {
        text += item.str;
        if (item.hasEOL) text += "\n";
      }
    }
    pages.push(text);
  }
  await doc.destroy();
  return pages;
}

export async function ingestPdf(path: string): Promise<TextDocument> {
  const buffer = await readFile(path);
  const pages = await readPdfPages(buffer);
  const segments: TextSegment[] = [];
  pages.forEach((pageText, p) => {
    const blocks = pageText
      .split(/\n\s*\n/)
      .map((b) => b.replace(/\s+/g, " ").trim())
      .filter((b) => b.length > 0);
    blocks.forEach((text, k) => {
      segments.push({
        index: segments.length,
        locator: `p.${p + 1}, bloque ${k + 1}`,
        text,
      });
    });
  });
  return {
    kind: "text",
    source: basename(path),
    path,
    fullText: pages.join("\n"),
    segments,
  };
}

// ---------- tabular ----------

function normalizeRows(
  records: Record<string, unknown>[],
): Record<string, TabularValue>[] {
  return records.map((r) => {
    const out: Record<string, TabularValue> = {};
    for (const [k, v] of Object.entries(r)) {
      out[k] =
        typeof v === "number" || typeof v === "boolean" || v === null
          ? v
          : String(v);
    }
    return out;
  });
}

export async function ingestCsv(path: string): Promise<TabularDocument> {
  const raw = await readFile(path, "utf8");
  const parsed = Papa.parse<Record<string, unknown>>(raw, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  const rows = normalizeRows(parsed.data);
  const columns = (parsed.meta.fields ?? []) as string[];
  return {
    kind: "tabular",
    source: basename(path),
    path,
    sheet: "csv",
    columns,
    rows,
  };
}

export async function ingestXlsx(path: string): Promise<TabularDocument[]> {
  const buffer = await readFile(path);
  const wb = readXlsx(buffer, { type: "buffer" });
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name]!;
    const records = xlsxUtils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
    });
    const rows = normalizeRows(records);
    const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];
    return {
      kind: "tabular" as const,
      source: basename(path),
      path,
      sheet: name,
      columns,
      rows,
    };
  });
}

// ---------- dispatch ----------

/** Ingiere un archivo según su extensión. XLSX puede producir varios docs (uno por hoja). */
export async function ingestFile(path: string): Promise<IngestedDocument[]> {
  const ext = extname(path).toLowerCase();
  if (TEXT_EXT.has(ext)) return [await ingestText(path)];
  if (ext === ".pdf") return [await ingestPdf(path)];
  if (ext === ".csv") return [await ingestCsv(path)];
  if (ext === ".xlsx" || ext === ".xls") return ingestXlsx(path);
  return []; // formato no soportado: se ignora silenciosamente
}

const SUPPORTED = new Set([".txt", ".md", ".pdf", ".csv", ".xlsx", ".xls"]);

/** Recolecta y normaliza todos los archivos soportados de un directorio (recursivo). */
export async function ingestDir(dir: string): Promise<IngestedDocument[]> {
  const out: IngestedDocument[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await ingestDir(full)));
    else if (SUPPORTED.has(extname(e.name).toLowerCase()))
      out.push(...(await ingestFile(full)));
  }
  return out;
}
