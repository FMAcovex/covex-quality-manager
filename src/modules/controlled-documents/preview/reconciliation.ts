import { indexMetadata } from "../import/domain";
import type { PreviewReport, PreviewRow } from "./types";
import { refreshSummary } from "./analysis";
import { fold } from "./normalization";
export type ExistingDepartment = {
    id: string;
    code: string;
    isActive: boolean;
    name?: string;
};
export type ExistingDocument = {
    id: string;
    baseCode: string | null;
    title: string | null;
    departmentId: string | null;
    departmentCodeSnapshot: string | null;
    administrativeStatus: string;
    documentType: string;
    revisions: {
        id: string;
        revisionCode: string;
        titleSnapshot: string | null;
        departmentCodeSnapshot: string | null;
        effectiveFrom: Date | null;
        reviewDueAt: Date | null;
        verificationStatus: string;
        status: string;
        consolidatedAt: Date | null;
        sourceMetadata?: unknown;
    }[];
};
const iso = (d: Date | null) => d ? d.toISOString().slice(0, 10) : null;
export function reconcileIndex(report: PreviewReport, departments: ExistingDepartment[], documents: ExistingDocument[]) {
    const deps = new Map(departments.map(d => [d.code, d])), docs = new Map(documents.filter(d => d.baseCode).map(d => [d.baseCode!, d]));
    for (const d of report.departments ?? []) {
        const existing = deps.get(d.code);
        d.status = existing ? (existing.isActive ? "EXISTING" : "INACTIVE") : d.annulled ? "ANNULLED_IN_INDEX" : "MISSING";
        if (existing?.name)
            d.existingName = existing.name;
    }
    for (const row of report.rows) {
        if (row.classification !== "PNT")
            continue;
        const n = row.normalized, department = n.departmentCode ? deps.get(n.departmentCode) : undefined;
        if (!department)
            row.issues.push("DEPARTMENT_UNKNOWN");
        else {
            row.reconciliation.departmentId = department.id;
            if (!department.isActive)
                row.issues.push("DEPARTMENT_INACTIVE");
        }
        const existing = n.baseCode ? docs.get(n.baseCode) : undefined;
        if (existing) {
            row.reconciliation.documentId = existing.id;
            const rev = existing.revisions.find(r => r.revisionCode === n.revisionCode);
            row.reconciliation.kind = rev ? "EXISTING_REVISION" : "EXISTING_DOCUMENT";
            if (rev) {
                row.reconciliation.revisionId = rev.id;
                row.reconciliation.persistedVerificationStatus = rev.verificationStatus;
                row.reconciliation.consolidated = !!rev.consolidatedAt;
            }
            const differences: NonNullable<PreviewRow["reconciliation"]["differences"]> = [];
            function compare(field: string, indexed: string | null, persisted: string | null, ignoreCase = false) { if ((ignoreCase ? fold(indexed || "") : indexed) !== (ignoreCase ? fold(persisted || "") : persisted))
                differences.push({ field, indexed, persisted }); }
            compare("Tipo documental", "PNT", existing.documentType);
            // Historical rows are compared with their revision snapshot, not a later master title/department.
            compare(rev ? "Título de la revisión" : "Título del maestro", n.title, rev ? rev.titleSnapshot : existing.title, true);
            compare(rev ? "Departamento de la revisión" : "Departamento del maestro", n.departmentCode, rev ? rev.departmentCodeSnapshot : existing.departmentCodeSnapshot);
            if (!rev && department && existing.departmentId && department.id !== existing.departmentId)
                differences.push({ field: "Correspondencia de departamento", indexed: n.departmentCode, persisted: existing.departmentCodeSnapshot });
            if (rev) {
                compare("Fecha de vigencia", n.effectiveFrom, iso(rev.effectiveFrom));
                compare("Fecha prevista de revisión", n.reviewDueAt, iso(rev.reviewDueAt));
                const declared = { IN_FORCE: "IN_FORCE", ANNULLED: "ANNULLED", IN_PREPARATION: "DRAFT", UNDETERMINED: null }[n.declaredState];
                if (rev.status === "IMPORTED_PENDING") {
                    const imported = indexMetadata(rev.sourceMetadata);
                    if (imported) compare("Estado declarado original del índice", n.declaredState, imported.declaredState);
                } else if (declared)
                    compare("Estado documental (declaración del índice)", declared, rev.status);
            }
            if (existing.administrativeStatus === "ANNULLED" && n.declaredState !== "ANNULLED")
                differences.push({ field: "Maestro anulado: requiere conciliación", indexed: n.declaredState, persisted: existing.administrativeStatus });
            if (differences.length) {
                row.reconciliation.differences = differences;
                row.issues.push("PERSISTED_CONFLICT");
                row.reconciliation.kind = "PERSISTED_CONFLICT";
            }
        }
        if (row.reconciliation.kind !== "PERSISTED_CONFLICT" && row.issues.some(i => ["MISSING_TITLE", "MISSING_REVISION", "INVALID_REVISION", "INVALID_DATE", "DEPARTMENT_UNKNOWN", "DEPARTMENT_MISMATCH", "LAYOUT_INFERRED", "CELL_ERROR", "STATE_CONFLICT", "REVISION_DISCREPANCY", "DATA_CONFLICT"].includes(i)))
            row.reconciliation.kind = "NOT_IMPORTABLE";
        row.issues = [...new Set(row.issues)];
    }
    return refreshSummary(report);
}
