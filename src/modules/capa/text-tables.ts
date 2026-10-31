import { annexTablePlacements, numberTextTables, type AnnexCell, type TextTables } from "@/lib/forms/text-tables";

// D-127: campos de texto largo de CAPA que admiten tablas, en el orden en que se numeran (el del
// formulario y del Anexo III). Las observaciones internas no van al anexo.
export const CAPA_TABLE_FIELDS = [
  "defectDescription",
  "rootCause",
  "actionFollowupObservations",
  "operationalStatusDescription",
  "effectivenessAssessment",
  "conclusion",
  "internalObservations",
] as const;

/** Nombre de cada campo, para los mensajes del resumen de errores. */
export const CAPA_TABLE_FIELD_LABELS: Record<(typeof CAPA_TABLE_FIELDS)[number], string> = {
  defectDescription: "Descripción del defecto",
  rootCause: "Causa raíz",
  actionFollowupObservations: "Seguimiento de las acciones",
  operationalStatusDescription: "Estado",
  effectivenessAssessment: "Valoración de la eficacia",
  conclusion: "Conclusión",
  internalObservations: "Observaciones internas",
};

/** Casilla del Anexo III de cada campo (tabla, fila, celda de la plantilla); null si no va al anexo. */
const ANNEX_III_CELLS: Record<(typeof CAPA_TABLE_FIELDS)[number], AnnexCell | null> = {
  defectDescription: { table: 0, row: 12, cell: 0 },
  rootCause: { table: 0, row: 14, cell: 0 },
  actionFollowupObservations: { table: 1, row: 4, cell: 0 },
  operationalStatusDescription: { table: 1, row: 7, cell: 0 },
  effectivenessAssessment: { table: 1, row: 10, cell: 0 },
  conclusion: { table: 1, row: 12, cell: 0 },
  internalObservations: null,
};

/** Clave de las tablas de la fila N (desde 0) de «Seguimiento de la acción» dentro de `Capa.textTables`. */
export function actionFollowupTablesKey(index: number) {
  return `actionFollowups.${index}`;
}

const FOLLOWUP_KEY = /^actionFollowups\.(\d+)$/;

/**
 * Orden de numeración de las tablas de una CAPA con `followups` filas de seguimiento de la acción: las de
 * cada fila van después de la causa raíz y antes de las observaciones del seguimiento (el orden del
 * formulario y del Anexo III).
 */
export function capaTableFields(followups: number): string[] {
  const at = CAPA_TABLE_FIELDS.indexOf("actionFollowupObservations");
  return [...CAPA_TABLE_FIELDS.slice(0, at), ...Array.from({ length: followups }, (_, index) => actionFollowupTablesKey(index)), ...CAPA_TABLE_FIELDS.slice(at)];
}

/** Como `capaTableFields`, contando también las filas que ya tengan tablas guardadas (para no perderlas al comparar). */
export function capaTableFieldsFor(tables: TextTables, followups: number) {
  const stored = Object.keys(tables).map((key) => FOLLOWUP_KEY.exec(key)).filter(Boolean).map((match) => Number(match![1]) + 1);
  return capaTableFields(Math.max(followups, ...stored));
}

/**
 * Dónde va cada tabla en el Anexo III, con la numeración de todo el expediente. `followups`: filas de
 * seguimiento de la acción; las tablas de cada una van a su casilla de descripción (fila copiada 2 + N de la
 * tabla 1). `copiedRows`: filas de la plantilla copiadas por acciones y seguimientos.
 */
export function capaAnnexTablePlacements(tables: TextTables, followups: number, copiedRows: Array<{ table: number; row: number; count: number }> = []) {
  const order = capaTableFieldsFor(tables, followups);
  const main = annexTablePlacements(tables, order, ANNEX_III_CELLS, copiedRows);
  const numbered = numberTextTables(tables, order);
  const rows = Array.from({ length: followups }, (_, index) => numbered[actionFollowupTablesKey(index)]?.length
    ? [{ table: 1, row: 2 + index, cell: 1, tables: numbered[actionFollowupTablesKey(index)]! }]
    : []);
  return [...main, ...rows.flat()];
}
