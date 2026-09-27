import { createHash } from "node:crypto";
import type { XlsxCellValue, XlsxRow } from "@/modules/deviations/import/xlsx-reader";

export type HistoricalCapaPlan = {
  actionType: "CORRECTIVE" | "PREVENTIVE";
  description: string;
  businessCapaCode: string | null;
};

export type HistoricalDeviationRow = {
  sourceSheet: string;
  sourceRow: number;
  year: number;
  departmentCode: string | null;
  departmentName: string | null;
  businessCode: string | null;
  materialProcessAffected: string | null;
  provenance: string | null;
  description: string | null;
  classification: "CRITICAL" | "MAJOR" | "MINOR" | null;
  rootCause: string | null;
  issueDate: Date | null;
  closedAt: Date | null;
  status: "OPEN" | "CLOSED";
  deadlineStatus: "NOT_EVALUATED" | "IN_TIME" | "OUT_OF_TIME" | "NA";
  measuresRaw: string | null;
  capaRaw: string | null;
  signedDocumentAvailable: boolean | null;
  internalObservations: string | null;
  recurrentRootCause: "YES" | "NO" | "NA" | null;
  affectsFinishedProduct: "YES" | "NO" | "NA" | null;
  normalizedOrigin: string | null;
  immediateActionRaw: string | null;
  capaPlans: HistoricalCapaPlan[];
  issues: string[];
  raw: Record<string, XlsxCellValue>;
};

function string(value: XlsxCellValue) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function date(value: XlsxCellValue) {
  if (typeof value === "number") {
    const utc = Math.round((value - 25569) * 86400 * 1000);
    const result = new Date(utc);
    return Number.isNaN(result.valueOf()) ? null : result;
  }
  const raw = string(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return null;
  const result = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  return Number.isNaN(result.valueOf()) ? null : result;
}

function classification(value: XlsxCellValue): HistoricalDeviationRow["classification"] {
  const raw = string(value)?.toLocaleLowerCase("es-ES");
  if (raw === "crítica" || raw === "critica") return "CRITICAL";
  if (raw === "mayor") return "MAJOR";
  if (raw === "menor") return "MINOR";
  return null;
}

function triState(value: XlsxCellValue): "YES" | "NO" | "NA" | null {
  const raw = string(value)?.toLocaleLowerCase("es-ES");
  if (raw === "sí" || raw === "si") return "YES";
  if (raw === "no") return "NO";
  if (raw === "n.a." || raw === "n.a" || raw === "na") return "NA";
  return null;
}

function yesNo(value: XlsxCellValue): boolean | null {
  const state = triState(value);
  return state === "YES" ? true : state === "NO" ? false : null;
}

function status(value: XlsxCellValue): "OPEN" | "CLOSED" {
  return string(value)?.toLocaleLowerCase("es-ES").startsWith("cerr") ? "CLOSED" : "OPEN";
}

function deadline(value: XlsxCellValue) {
  const state = triState(value);
  return state === "YES" ? "IN_TIME" : state === "NO" ? "OUT_OF_TIME" : "NOT_EVALUATED";
}

export function extractCapaPlans(rawValue: XlsxCellValue): HistoricalCapaPlan[] {
  const raw = string(rawValue);
  if (!raw) return [];
  const matches = [...raw.matchAll(/\b(A[CP])\/([A-Z0-9-]+)\/(\d{3})\/(\d{4})\b/gi)];
  const seen = new Set<string>();
  return matches.flatMap((match) => {
    const code = match[0].toUpperCase();
    if (seen.has(code)) return [];
    seen.add(code);
    return [{
      actionType: code.startsWith("AP/") ? "PREVENTIVE" as const : "CORRECTIVE" as const,
      description: code,
      businessCapaCode: code,
    }];
  });
}

function hasImmediate(measures: string | null) {
  return Boolean(measures && /inmediata/i.test(measures));
}

function commonIssues(row: HistoricalDeviationRow) {
  const issues = ["HISTORICAL_LIST_ONLY"];
  if (!row.departmentCode) issues.push("MISSING_DEPARTMENT");
  if (!row.businessCode) issues.push("MISSING_BUSINESS_CODE");
  if (!row.description) issues.push("MISSING_DESCRIPTION");
  if (!row.issueDate) issues.push("MISSING_OR_INVALID_OPENING_DATE");
  if (!row.classification) issues.push("MISSING_OR_INVALID_CLASSIFICATION");
  if (row.recurrentRootCause === null) issues.push("RECURRENCE_NOT_RECORDED");
  if (row.affectsFinishedProduct === null) issues.push("FINISHED_PRODUCT_IMPACT_NOT_RECORDED");
  if (!row.measuresRaw) issues.push("MEASURES_NOT_RECORDED");
  if (/CAPA/i.test(row.measuresRaw ?? "") && row.capaPlans.length === 0) {
    issues.push("CAPA_TEXT_NOT_STRUCTURED");
  }
  return issues;
}

function map2025(row: XlsxRow, departmentNames: Map<string, string>): HistoricalDeviationRow {
  const raw = row.cells;
  const measuresRaw = string(raw.N);
  const capaRaw = string(raw.O);
  const mapped: HistoricalDeviationRow = {
    sourceSheet: "2025",
    sourceRow: row.rowNumber,
    year: 2025,
    departmentCode: string(raw.B),
    departmentName: string(raw.D) ?? departmentNames.get(string(raw.B) ?? "") ?? null,
    businessCode: string(raw.C),
    materialProcessAffected: string(raw.E),
    provenance: string(raw.F),
    description: string(raw.G),
    classification: classification(raw.H),
    rootCause: string(raw.I),
    issueDate: date(raw.J),
    closedAt: date(raw.K),
    status: status(raw.L),
    deadlineStatus: deadline(raw.M),
    measuresRaw,
    capaRaw,
    signedDocumentAvailable: yesNo(raw.P),
    internalObservations: string(raw.Q),
    recurrentRootCause: triState(raw.S),
    affectsFinishedProduct: triState(raw.T),
    normalizedOrigin: string(raw.U),
    immediateActionRaw: hasImmediate(measuresRaw) ? capaRaw ?? measuresRaw : null,
    capaPlans: extractCapaPlans(raw.O),
    issues: [],
    raw,
  };
  mapped.issues = commonIssues(mapped);
  if (mapped.immediateActionRaw && /CAPA/i.test(measuresRaw ?? "")) mapped.issues.push("LEGACY_COMBINED_ACTION_TEXT");
  return mapped;
}

function map2026(row: XlsxRow, departmentNames: Map<string, string>): HistoricalDeviationRow {
  const raw = row.cells;
  const measuresRaw = string(raw.L);
  const capaRaw = string(raw.M);
  const mapped: HistoricalDeviationRow = {
    sourceSheet: "2026",
    sourceRow: row.rowNumber,
    year: 2026,
    departmentCode: string(raw.B),
    departmentName: departmentNames.get(string(raw.B) ?? "") ?? null,
    businessCode: string(raw.C),
    materialProcessAffected: string(raw.D),
    provenance: string(raw.E),
    description: string(raw.F),
    classification: classification(raw.G),
    rootCause: string(raw.H),
    issueDate: date(raw.I),
    closedAt: date(raw.J),
    status: status(raw.K),
    deadlineStatus: "NOT_EVALUATED",
    measuresRaw,
    capaRaw,
    signedDocumentAvailable: null,
    internalObservations: string(raw.N),
    recurrentRootCause: triState(raw.Q),
    affectsFinishedProduct: triState(raw.R),
    normalizedOrigin: string(raw.S),
    immediateActionRaw: hasImmediate(measuresRaw) ? measuresRaw : null,
    capaPlans: extractCapaPlans(raw.M),
    issues: ["DEADLINE_NOT_AVAILABLE_IN_2026_SOURCE", "SIGNED_DOCUMENT_STATUS_NOT_AVAILABLE_IN_2026_SOURCE"],
    raw,
  };
  mapped.issues.push(...commonIssues(mapped));
  return mapped;
}

export function departmentCatalogFrom2025(rows: XlsxRow[]) {
  const catalog = new Map<string, string>();
  for (const row of rows) {
    const code = string(row.cells.X);
    const name = string(row.cells.Y);
    if (code && name) catalog.set(code, name);
  }
  return catalog;
}

export function mapHistoricalRows(rows2025: XlsxRow[], rows2026: XlsxRow[]) {
  const departments = departmentCatalogFrom2025(rows2025);
  const mapped = [
    ...rows2025.filter((row) => /^D\//.test(string(row.cells.C) ?? "")).map((row) => map2025(row, departments)),
    ...rows2026.filter((row) => /^D\//.test(string(row.cells.C) ?? "")).map((row) => map2026(row, departments)),
  ];
  const codes = new Map<string, number>();
  for (const row of mapped) {
    if (!row.businessCode) continue;
    codes.set(row.businessCode, (codes.get(row.businessCode) ?? 0) + 1);
  }
  for (const row of mapped) {
    if (row.businessCode && (codes.get(row.businessCode) ?? 0) > 1) row.issues.push("DUPLICATE_CODE_IN_SOURCE");
    if (!row.departmentName) row.issues.push("DEPARTMENT_NAME_NOT_IN_SOURCE_CATALOG");
  }
  return mapped;
}

export function workbookSha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
