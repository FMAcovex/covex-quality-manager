export type Cell = {
    column: number;
    reference: string;
    value: string;
    type: string;
    formula: string | null;
    rawValue: string;
};
export type SheetRow = {
    number: number;
    cells: Cell[];
};
export type WorkbookSheet = {
    name: string;
    rows: SheetRow[];
};
export type Workbook = {
    sheets: WorkbookSheet[];
    excludedSheets: {
        name: string;
        reason: string;
    }[];
    sheetCount: number;
    date1904: boolean;
};
export type IssueCode = "LAYOUT_INFERRED" | "MISSING_CODE" | "MISSING_TITLE" | "MISSING_REVISION" | "INVALID_REVISION" | "INVALID_DATE" | "MISSING_DATES" | "DEPARTMENT_UNKNOWN" | "DEPARTMENT_INACTIVE" | "DEPARTMENT_MISMATCH" | "DUPLICATE" | "DUPLICATE_IN_SHEET" | "REVISION_DISCREPANCY" | "DATA_CONFLICT" | "TITLE_DISCREPANCY" | "PERSISTED_CONFLICT" | "FORMULA_CACHE" | "CELL_ERROR" | "STATE_CONFLICT" | "FUTURE_EFFECTIVE";
export const issueLabels: Record<IssueCode, string> = {
    LAYOUT_INFERRED: "Columnas inferidas: contrastar encabezados", MISSING_CODE: "Código ausente", MISSING_TITLE: "Título ausente", MISSING_REVISION: "Revisión no documentada", INVALID_REVISION: "Revisión no interpretable", INVALID_DATE: "Fecha no interpretable", MISSING_DATES: "Fechas incompletas", DEPARTMENT_UNKNOWN: "Departamento sin correspondencia", DEPARTMENT_INACTIVE: "Departamento histórico/inactivo", DEPARTMENT_MISMATCH: "Código y departamento no coinciden", DUPLICATE: "Código repetido", DUPLICATE_IN_SHEET: "Duplicidad dentro de una hoja", REVISION_DISCREPANCY: "Revisiones diferentes: decidir manualmente", DATA_CONFLICT: "Datos contradictorios para la misma revisión", TITLE_DISCREPANCY: "Títulos diferentes para el mismo código", PERSISTED_CONFLICT: "Diferencia con datos persistidos", FORMULA_CACHE: "Fórmula: valor almacenado sin recalcular", CELL_ERROR: "Error de celda Excel", STATE_CONFLICT: "Estados declarados contradictorios", FUTURE_EFFECTIVE: "Vigencia futura sin acreditar aprobación"
};
export type DeclaredState = "IN_FORCE" | "ANNULLED" | "IN_PREPARATION" | "UNDETERMINED";
export const declaredStateLabels: Record<DeclaredState, string> = { IN_FORCE: "Vigente según índice", ANNULLED: "Anulado según índice", IN_PREPARATION: "En elaboración según índice", UNDETERMINED: "Sin determinar" };
export type ReconciliationKind = "NEW_DOCUMENT" | "EXISTING_DOCUMENT" | "EXISTING_REVISION" | "PERSISTED_CONFLICT" | "NOT_IMPORTABLE";
export const reconciliationLabels: Record<ReconciliationKind, string> = { NEW_DOCUMENT: "Documento nuevo", EXISTING_DOCUMENT: "Maestro existente / revisión no registrada", EXISTING_REVISION: "Revisión ya existente", PERSISTED_CONFLICT: "Conflicto con datos persistidos", NOT_IMPORTABLE: "No importable sin resolver incidencias" };
export type PreviewRow = {
    sourceKey: string;
    identityKey: string | null;
    revisionKey: string | null;
    source: {
        fileName: string;
        sha256: string;
        sheet: string;
        row: number;
        originalCode: string;
        values: Cell[];
    };
    normalized: {
        baseCode: string | null;
        revisionCode: string | null;
        title: string;
        departmentCode: string | null;
        effectiveFrom: string | null;
        reviewDueAt: string | null;
        declaredState: DeclaredState;
        stateBasis: "EXPLICIT" | "DATES" | "UNKNOWN";
        reviewOverdue: boolean;
    };
    classification: "PNT" | "OTHER";
    family: string;
    issues: IssueCode[];
    verificationStatus: "UNVERIFIED";
    decision: "PENDING" | "EXCLUDED";
    reconciliation: {
        kind: ReconciliationKind;
        documentId?: string;
        revisionId?: string;
        persistedVerificationStatus?: string;
        consolidated?: boolean;
        departmentId?: string;
        differences?: {
            field: string;
            indexed: string | null;
            persisted: string | null;
        }[];
    };
};
export type DuplicateGroup = {
    baseCode: string;
    rowKeys: string[];
    kinds: IssueCode[];
};
/** Departamento de una hoja del índice (D-097): código de la hoja y nombre de su cabecera. */
export type IndexDepartmentStatus = "EXISTING" | "INACTIVE" | "MISSING" | "ANNULLED_IN_INDEX";
export type IndexDepartment = {
    code: string;
    name: string | null;
    annulled: boolean;
    sheets: string[];
    pntRows: number;
    status?: IndexDepartmentStatus;
    existingName?: string;
};
export const indexDepartmentStatusLabels: Record<IndexDepartmentStatus, string> = { EXISTING: "Ya existe", INACTIVE: "Existe inactivo", MISSING: "Falta en Configuración", ANNULLED_IN_INDEX: "Anulado en el índice: no se da de alta" };
export type PreviewReport = {
    contractVersion: 1;
    fileName: string;
    sha256: string;
    asOf: string;
    sheetCount: number;
    interpretedSheets: string[];
    excludedSheets: Workbook["excludedSheets"];
    rows: PreviewRow[];
    groups: DuplicateGroup[];
    /** Ausente en lotes guardados antes de D-097. */
    departments?: IndexDepartment[];
    summary: {
        analyzedRows: number;
        pntCandidates: number;
        uniqueCodes: number;
        duplicateGroups: number;
        additionalAppearances: number;
        discrepancyGroups: number;
        revisionDiscrepancyGroups: number;
        otherDocuments: number;
        incompleteRows: number;
        departmentReviewRows: number;
        annulledRows: number;
        inPreparationRows: number;
        overdueRows: number;
        pendingVerification: number;
        newDocuments: number;
        existingDocuments: number;
        existingRevisions: number;
        persistedConflicts: number;
        notImportable: number;
    };
};
