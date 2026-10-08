import { posix } from "node:path";
import { readZip } from "../../../lib/ooxml/zip";
import type { Workbook, Cell } from "./types";
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export function excludedSheet(name: string): string | null {
    const n = name.trim().toUpperCase();
    if (n === "GC-00")
        return "Fuente descartada expresamente: únicamente GC-00( es válida para GC-00.";
    if (n === "PORTADA" || n === "CADUCIDADES 2026")
        return "Hoja secundaria; no es una tabla primaria de importación.";
    return null;
}
export function decodeXml(v: string) {
    return v.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
        if (entity.startsWith("#")) {
            const cp = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
            if (cp > 0x10ffff || cp < 0 || cp >= 0xd800 && cp <= 0xdfff)
                throw new Error("Entidad XML inválida.");
            return String.fromCodePoint(cp);
        }
        return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[entity.toLowerCase()];
    });
}
export function attributes(v: string) { return Object.fromEntries([...v.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => [m[1], decodeXml(m[2] ?? m[3])])); }
export function elements(xml: string, tag: string) { const re = new RegExp(`<(?:(?:[\\w.-]+):)?${tag}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/(?:(?:[\\w.-]+):)?${tag}\\s*>)`, "g"); return [...xml.matchAll(re)].map(m => ({ attrs: attributes(m[1]), body: m[2] || "" })); }
function text(xml: string) { return elements(xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, ""), "t").map(t => decodeXml(t.body)).join(""); }
function column(reference: string) {
    const m = reference.match(/^([A-Z]+)\d+$/);
    if (!m)
        throw new Error("Referencia de celda inválida.");
    return [...m[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
}
export function readWorkbook(buffer: Buffer): Workbook {
    if (!buffer.length || buffer.length > MAX_FILE_BYTES)
        throw new Error("Selecciona un XLSX de hasta 8 MiB.");
    let entries;
    try {
        entries = readZip(buffer, { maxExpandedBytes: 64 * 1024 * 1024, verifyIntegrity: true });
    }
    catch {
        throw new Error("El XLSX no es válido o supera el límite de expansión.");
    }
    const files = new Map(entries.map(e => [e.name, e.data]));
    function xml(path: string) {
        const data = files.get(path);
        if (!data)
            throw new Error("El XLSX carece de un componente necesario.");
        const value = data.toString("utf8");
        if (/<!DOCTYPE|<!ENTITY/i.test(value))
            throw new Error("No se admiten declaraciones de entidades XML.");
        return value;
    }
    const book = xml("xl/workbook.xml");
    const allSheets = elements(book, "sheet");
    if (!allSheets.length || allSheets.length > 128)
        throw new Error("Número de hojas no admitido.");
    const relationships = new Map(elements(xml("xl/_rels/workbook.xml.rels"), "Relationship").map(r => [r.attrs.Id, r.attrs]));
    const shared = files.has("xl/sharedStrings.xml") ? elements(xml("xl/sharedStrings.xml"), "si").map(s => text(s.body)) : [];
    const result: Workbook = { sheets: [], excludedSheets: [], sheetCount: allSheets.length, date1904: ["1", "true"].includes(elements(book, "workbookPr")[0]?.attrs.date1904 || "") };
    let cellsRead = 0, rowsRead = 0;
    for (const sh of allSheets) {
        const name = sh.attrs.name;
        const excluded = excludedSheet(name);
        // Do not resolve or interpret excluded worksheets, even if their XML is malformed.
        if (excluded) {
            result.excludedSheets.push({ name, reason: excluded });
            continue;
        }
        const relation = relationships.get(sh.attrs["r:id"]);
        if (!relation || relation.TargetMode === "External")
            throw new Error("Referencia de hoja no admitida.");
        const target = relation.Target.startsWith("/") ? relation.Target.slice(1) : posix.normalize(posix.join("xl", relation.Target));
        if (!target.startsWith("xl/") || target.includes("\\"))
            throw new Error("Ruta de hoja no admitida.");
        const sheet = { name, rows: [] as Workbook["sheets"][number]["rows"] };
        const seenRows = new Set<number>();
        for (const row of elements(xml(target), "row")) {
            if (++rowsRead > 100000)
                throw new Error("El XLSX supera el límite de filas.");
            const number = Number(row.attrs.r);
            if (!Number.isInteger(number) || number < 1 || number > 1048576 || seenRows.has(number))
                throw new Error("Número de fila inválido.");
            seenRows.add(number);
            const cells: Cell[] = [];
            const seenCells = new Set<string>();
            for (const cell of elements(row.body, "c")) {
                if (++cellsRead > 1000000)
                    throw new Error("El XLSX supera el límite de celdas.");
                const a = cell.attrs;
                if (seenCells.has(a.r) || !a.r.endsWith(String(number)) || Number(a.r.match(/[0-9]+$/)?.[0]) !== number || column(a.r) > 16383)
                    throw new Error("Referencia de celda duplicada o incoherente.");
                seenCells.add(a.r);
                const rawValue = decodeXml(elements(cell.body, "v")[0]?.body || "");
                let value = rawValue;
                if (a.t === "s") {
                    const idx = Number(rawValue);
                    if (!/^\d+$/.test(rawValue) || shared[idx] === undefined)
                        throw new Error("Referencia de texto compartido inválida.");
                    value = shared[idx];
                }
                else if (a.t === "inlineStr")
                    value = text(cell.body);
                cells.push({ column: column(a.r), reference: a.r, value, type: a.t || "n", rawValue, formula: elements(cell.body, "f")[0]?.body ?? null });
            }
            sheet.rows.push({ number, cells });
        }
        result.sheets.push(sheet);
    }
    return result;
}
