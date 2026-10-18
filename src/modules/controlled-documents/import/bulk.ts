import { validBaseCode, validRevisionCode } from "../domain";
import type { IssueCode, PreviewRow } from "../preview/types";

// Inclusión en bloque (decisión del responsable de Calidad, D-093): las filas PNT vigentes
// sin incidencias y las anuladas según el índice se incluyen con los datos tal como vienen
// en el índice. Se importan sin verificar, como cualquier fila; el resto se decide una a una.
const harmless: IssueCode[] = ["FORMULA_CACHE"];
// Un anulado no suele tener fechas ni revisión en el índice: no impiden registrar el código.
const annulledHarmless: IssueCode[] = [...harmless, "MISSING_DATES", "MISSING_REVISION", "INVALID_DATE", "INVALID_REVISION"];

export type BulkKind = "IN_FORCE" | "ANNULLED";

/** ¿La fila puede incluirse en bloque? Devuelve el estado declarado que la habilita. */
export function bulkEligibility(row: Pick<PreviewRow, "classification" | "issues" | "normalized" | "source">): BulkKind | null {
  const n = row.normalized;
  if (row.classification !== "PNT" || !n.baseCode || !validBaseCode(n.baseCode) || !n.title.trim()) return null;
  if (row.source.sheet === "GC-00" || (n.baseCode.startsWith("GC-00/") && row.source.sheet !== "GC-00(")) return null;
  if (n.declaredState === "IN_FORCE") {
    return row.issues.every((issue) => harmless.includes(issue)) && n.revisionCode && validRevisionCode(n.revisionCode) && n.effectiveFrom ? "IN_FORCE" : null;
  }
  if (n.declaredState === "ANNULLED") return row.issues.every((issue) => annulledHarmless.includes(issue)) ? "ANNULLED" : null;
  return null;
}

/** Resolución con los datos del índice; las fechas y revisión no interpretables quedan vacías. */
export function bulkResolution(row: Pick<PreviewRow, "normalized">, departmentId: string, reason: string) {
  const n = row.normalized;
  const valid = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");
  const effectiveFrom = valid(n.effectiveFrom), reviewDueAt = valid(n.reviewDueAt);
  return {
    title: n.title.trim().slice(0, 500),
    revisionCode: n.revisionCode && validRevisionCode(n.revisionCode) ? n.revisionCode : "",
    effectiveFrom,
    reviewDueAt: effectiveFrom && reviewDueAt && reviewDueAt < effectiveFrom ? "" : reviewDueAt,
    declaredState: n.declaredState,
    departmentId,
    reviewed: true as const,
    reason,
  };
}

/** Recuento para el botón: filas pendientes que se incluirían en bloque. */
export function bulkCounts(rows: ReadonlyArray<{ decision: string; result: unknown; data: Pick<PreviewRow, "classification" | "issues" | "normalized" | "source"> }>) {
  const kinds = rows.filter((row) => row.decision === "PENDING" && !row.result).map((row) => bulkEligibility(row.data));
  return { inForce: kinds.filter((kind) => kind === "IN_FORCE").length, annulled: kinds.filter((kind) => kind === "ANNULLED").length };
}
