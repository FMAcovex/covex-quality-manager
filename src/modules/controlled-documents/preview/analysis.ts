import { createHash } from "node:crypto";
import type { WorkbookSheet, SheetRow, PreviewRow, PreviewReport, IssueCode, IndexDepartment } from "./types";
import { readWorkbook } from "./workbook";
import { departmentFromSheet, normalizeCode, normalizeDate, normalizeRevision, marker, fold, family } from "./normalization";
type Layout = {
    code: number;
    title: number;
    revision: number;
    effective: number;
    review: number;
    inferred: boolean;
};
const headerCode = (v: string) => /^(CODIGO|CODIGO (?:DEL )?(?:PNT|DOCUMENTO))$/.test(fold(v));
function detectLayout(rows: SheetRow[], at: number): Layout | null {
    const codeCell = rows[at].cells.find(c => headerCode(c.value));
    if (!codeCell)
        return null;
    const labels = new Map<number, string[]>();
    const headingWords = new Set(["CODIGO", "DEL", "DE", "PNT", "DOCUMENTO", "TITULO", "DENOMINACION", "NOMBRE", "FECHA", "REV", "REVISION", "VIGENCIA", "ANULACION", "CADUCIDAD", "ENTRADA", "EN", "VIGOR", "PREVISTA", "VERSION", "VIGENTE", "EDICION"]);
    for (let i = Math.max(0, at - 2); i < Math.min(rows.length, at + 4); i++) {
        const row = rows[i];
        const rawCode = row.cells.find(c => c.column === codeCell.column)?.value || "";
        if (row.cells.some(c => normalizeCode(c.value))) {
            if (i > at)
                break;
            continue;
        }
        if (i > at && rawCode && !headerCode(rawCode) && /[0-9/]/.test(rawCode))
            break;
        for (const c of row.cells) {
            const v = fold(c.value), words = v.replace(/[^A-Z ]/g, " ").split(/\s+/).filter(Boolean);
            if (words.length && words.every(w => headingWords.has(w)))
                labels.set(c.column, [...(labels.get(c.column) || []), v]);
        }
    }
    const cols = [...labels].map(([column, values]) => ({ column, label: values.join(" ") }));
    const title = cols.find(c => /TITULO|DENOMINACION|NOMBRE/.test(c.label))?.column;
    const effective = cols.find(c => /VIGENCIA|ANULACION|ENTRADA/.test(c.label))?.column;
    const review = cols.find(c => /CADUCIDAD|REVISION PREVISTA|FECHA.*REVISION/.test(c.label))?.column;
    const revision = cols.find(c => c.column !== review && c.column !== effective && /(?:^| )REV(?:\.|ISION)?(?: |$)|EDICION|VERSION/.test(c.label))?.column;
    return { code: codeCell.column, title: title ?? codeCell.column + 1, revision: revision ?? codeCell.column + 2, effective: effective ?? codeCell.column + 3, review: review ?? codeCell.column + 4, inferred: [title, revision, effective, review].some(v => v === undefined) };
}
function dataRows(sheet: WorkbookSheet): {
    row: SheetRow;
    layout: Layout;
}[] {
    let layout: Layout | null = null;
    const result: {
        row: SheetRow;
        layout: Layout;
    }[] = [];
    for (let i = 0; i < sheet.rows.length; i++) {
        const row = sheet.rows[i];
        const header = detectLayout(sheet.rows, i);
        if (header) {
            layout = header;
            continue;
        }
        if (!layout) {
            const code = row.cells.find(c => normalizeCode(c.value));
            if (!code)
                continue;
            layout = { code: code.column, title: code.column + 1, revision: code.column + 2, effective: code.column + 3, review: code.column + 4, inferred: true };
        }
        const get = (col: number) => row.cells.find(c => c.column === col)?.value.trim() || "";
        const rawCode = get(layout.code), title = get(layout.title);
        if (!normalizeCode(rawCode) && row.cells.some(c => /^(?:NUMERO TOTAL DE CODIGOS|FORMACION DE CODIGOS|TOTAL CODIGOS|TOTAL DE CODIGOS|CADUCIDADES PNT)/.test(fold(c.value))))
            continue;
        if (headerCode(rawCode) || /^(?:TOTAL|NUMERO TOTAL|N[º°.]? TOTAL|INDICE|CODIGOS|FECHA|REV\.?$)/.test(fold(rawCode)))
            continue;
        if (!rawCode && !title)
            continue;
        if (!normalizeCode(rawCode) && !title && !/[\d/]/.test(rawCode) && family(rawCode, "") === "OTHER")
            continue;
        // Multi-row headings are not document records.
        if (!normalizeCode(rawCode) && !rawCode && /^(TITULO|DENOMINACION|NOMBRE)$/.test(fold(title)))
            continue;
        result.push({ row, layout });
    }
    return result;
}
/**
 * Nombre del departamento según la cabecera de la hoja: la fila con «Nº XX-00» lleva el nombre
 * en otra celda. «DEPARTAMENTO ANULADO» en ese nombre marca el departamento como anulado (D-097).
 */
export function sheetDepartmentHeader(sheet: WorkbookSheet, code: string): { name: string | null; annulled: boolean } {
    for (const row of sheet.rows.slice(0, 12)) {
        const marker = row.cells.find(c => fold(c.value).match(/^N\s*[º°O.]?\s*([A-Z]{2}-\d{2})$/)?.[1] === code);
        if (!marker)
            continue;
        const raw = row.cells.find(c => c !== marker && c.value.trim())?.value ?? "";
        const annulled = /DEPARTAMENTO\s+ANULADO/.test(fold(raw));
        const name = raw.replace(/departamento\s+anulado/gi, " ").replace(/\s+/g, " ").trim().replace(/[\s:;,-]+$/, "").slice(0, 200);
        return { name: name || null, annulled };
    }
    return { name: null, annulled: false };
}
function indexDepartments(sheets: WorkbookSheet[], rows: PreviewRow[]): IndexDepartment[] {
    const result = new Map<string, IndexDepartment>();
    for (const sheet of sheets) {
        const code = departmentFromSheet(sheet.name);
        if (!code)
            continue;
        const header = sheetDepartmentHeader(sheet, code), current = result.get(code);
        if (current) {
            current.sheets.push(sheet.name);
            current.name ??= header.name;
            current.annulled ||= header.annulled;
        }
        else
            result.set(code, { code, name: header.name, annulled: header.annulled, sheets: [sheet.name], pntRows: 0 });
    }
    for (const row of rows) {
        const department = row.classification === "PNT" && row.normalized.departmentCode ? result.get(row.normalized.departmentCode) : undefined;
        if (department)
            department.pntRows++;
    }
    return [...result.values()].sort((a, b) => a.code.localeCompare(b.code));
}
export function parseIndex(buffer: Buffer, fileName: string, asOf = new Date().toISOString().slice(0, 10)): PreviewReport {
    const workbook = readWorkbook(buffer);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const rows: PreviewRow[] = [];
    for (const sheet of workbook.sheets)
        for (const { row, layout } of dataRows(sheet)) {
            const cell = (col: number) => row.cells.find(c => c.column === col);
            const value = (col: number) => cell(col)?.value.trim() || "";
            const originalCode = cell(layout.code)?.value || "", title = value(layout.title), code = normalizeCode(originalCode), rawRevision = value(layout.revision);
            const columnRevision = normalizeRevision(rawRevision);
            const revisionConflict = !!code?.embeddedRevision && !!columnRevision && code.embeddedRevision !== columnRevision;
            const revision = revisionConflict ? null : columnRevision || code?.embeddedRevision || null;
            const effective = normalizeDate(value(layout.effective), cell(layout.effective)?.type || "str", workbook.date1904);
            const review = normalizeDate(value(layout.review), cell(layout.review)?.type || "str", workbook.date1904);
            const departmentCode = departmentFromSheet(sheet.name);
            const issues: IssueCode[] = [];
            if (layout.inferred)
                issues.push("LAYOUT_INFERRED");
            const knownMarkers = [...new Set(row.cells.filter(c => c.column !== layout.title).map(c => marker(c.value)).filter(x => x !== null))];
            if (knownMarkers.length > 1)
                issues.push("STATE_CONFLICT");
            const state = knownMarkers.length === 1 ? knownMarkers[0] : knownMarkers.length > 1 ? "UNDETERMINED" : effective.value && effective.value <= asOf && revision ? "IN_FORCE" : "UNDETERMINED";
            const stateBasis = knownMarkers.length === 1 ? "EXPLICIT" : state === "IN_FORCE" ? "DATES" : "UNKNOWN";
            const classification = code && !/^PLAN(?:ES)? MAESTR/.test(fold(title)) ? "PNT" : "OTHER";
            if (!originalCode.trim())
                issues.push("MISSING_CODE");
            if (!title)
                issues.push("MISSING_TITLE");
            if (classification === "PNT") {
                if (!revision)
                    issues.push("MISSING_REVISION");
                if (rawRevision && !normalizeRevision(rawRevision) && !marker(rawRevision) && !/^N\/?A$/i.test(rawRevision))
                    issues.push("INVALID_REVISION");
                if (code?.embeddedRevision && normalizeRevision(rawRevision) && code.embeddedRevision !== normalizeRevision(rawRevision))
                    issues.push("REVISION_DISCREPANCY");
                if (effective.invalid || review.invalid)
                    issues.push("INVALID_DATE");
                if (!effective.value || !review.value)
                    issues.push("MISSING_DATES");
                if (!departmentCode)
                    issues.push("DEPARTMENT_UNKNOWN");
                if (departmentCode && code?.baseCode.split("/")[0] !== departmentCode)
                    issues.push("DEPARTMENT_MISMATCH");
                if (effective.value && effective.value > asOf && state !== "IN_PREPARATION")
                    issues.push("FUTURE_EFFECTIVE");
            }
            if (row.cells.some(c => c.formula !== null))
                issues.push("FORMULA_CACHE");
            if (row.cells.some(c => c.type === "e"))
                issues.push("CELL_ERROR");
            const sourceKey = createHash("sha256").update(JSON.stringify([sha256, sheet.name, row.number])).digest("hex");
            rows.push({ sourceKey, identityKey: code?.baseCode || null, revisionKey: code && revision ? `${code.baseCode}/${revision}` : null, source: { fileName, sha256, sheet: sheet.name, row: row.number, originalCode, values: row.cells }, normalized: { baseCode: code?.baseCode || null, revisionCode: revision, title, departmentCode, effectiveFrom: effective.value, reviewDueAt: review.value, declaredState: state, stateBasis, reviewOverdue: state === "IN_FORCE" && !!review.value && review.value < asOf }, classification, family: classification === "PNT" ? "PNT" : family(originalCode, title), issues: [...new Set(issues)], verificationStatus: "UNVERIFIED", decision: classification === "PNT" ? "PENDING" : "EXCLUDED", reconciliation: { kind: classification === "PNT" ? "NEW_DOCUMENT" : "NOT_IMPORTABLE" } });
        }
    const byCode = new Map<string, PreviewRow[]>();
    for (const row of rows)
        if (row.classification === "PNT" && row.identityKey)
            byCode.set(row.identityKey, [...(byCode.get(row.identityKey) || []), row]);
    const groups: PreviewReport["groups"] = [];
    for (const [baseCode, members] of byCode) {
        if (members.length < 2)
            continue;
        const kinds: IssueCode[] = ["DUPLICATE"];
        if (new Set(members.map(r => r.normalized.revisionCode).filter(Boolean)).size > 1)
            kinds.push("REVISION_DISCREPANCY");
        if (new Set(members.map(r => fold(r.normalized.title))).size > 1)
            kinds.push("TITLE_DISCREPANCY");
        if (new Set(members.map(r => r.source.sheet)).size < members.length)
            kinds.push("DUPLICATE_IN_SHEET");
        const revs = new Map<string | null, PreviewRow[]>();
        for (const r of members)
            revs.set(r.normalized.revisionCode, [...(revs.get(r.normalized.revisionCode) || []), r]);
        for (const sameRevision of revs.values())
            if (new Set(sameRevision.map(r => JSON.stringify({ ...r.normalized, title: fold(r.normalized.title), reviewOverdue: undefined, stateBasis: undefined }))).size > 1) {
                kinds.push("DATA_CONFLICT");
                break;
            }
        if (new Set(members.map(r => r.normalized.departmentCode)).size > 1)
            kinds.push("DEPARTMENT_MISMATCH");
        for (const row of members)
            row.issues = [...new Set([...row.issues, ...kinds])];
        groups.push({ baseCode, rowKeys: members.map(r => r.sourceKey), kinds });
    }
    const report: PreviewReport = { contractVersion: 1, fileName, sha256, asOf, sheetCount: workbook.sheetCount, interpretedSheets: workbook.sheets.map(s => s.name), excludedSheets: workbook.excludedSheets, rows, groups, departments: indexDepartments(workbook.sheets, rows), summary: {} as PreviewReport["summary"] };
    return refreshSummary(report);
}
export function refreshSummary(report: PreviewReport) {
    const { rows, groups } = report;
    const pnt = rows.filter(r => r.classification === "PNT");
    const count = (predicate: (row: PreviewRow) => boolean) => rows.filter(predicate).length;
    report.summary = { analyzedRows: rows.length, pntCandidates: pnt.length, uniqueCodes: new Set(pnt.map(r => r.identityKey)).size, duplicateGroups: groups.length, additionalAppearances: groups.reduce((n, g) => n + g.rowKeys.length - 1, 0), discrepancyGroups: groups.filter(g => g.kinds.some(k => ["REVISION_DISCREPANCY", "DATA_CONFLICT", "TITLE_DISCREPANCY", "DEPARTMENT_MISMATCH"].includes(k))).length, revisionDiscrepancyGroups: groups.filter(g => g.kinds.includes("REVISION_DISCREPANCY")).length, otherDocuments: count(r => r.classification === "OTHER"), incompleteRows: count(r => r.issues.some(i => ["MISSING_CODE", "MISSING_TITLE", "MISSING_REVISION", "MISSING_DATES"].includes(i))), departmentReviewRows: count(r => r.issues.some(i => ["DEPARTMENT_UNKNOWN", "DEPARTMENT_INACTIVE", "DEPARTMENT_MISMATCH"].includes(i))), annulledRows: count(r => r.normalized.declaredState === "ANNULLED"), inPreparationRows: count(r => r.normalized.declaredState === "IN_PREPARATION"), overdueRows: count(r => r.normalized.reviewOverdue), pendingVerification: pnt.length, newDocuments: count(r => r.reconciliation.kind === "NEW_DOCUMENT"), existingDocuments: count(r => r.reconciliation.kind === "EXISTING_DOCUMENT"), existingRevisions: count(r => r.reconciliation.kind === "EXISTING_REVISION"), persistedConflicts: count(r => r.reconciliation.kind === "PERSISTED_CONFLICT"), notImportable: count(r => r.reconciliation.kind === "NOT_IMPORTABLE") };
    return report;
}
