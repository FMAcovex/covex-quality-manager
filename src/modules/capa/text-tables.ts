import { annexTablePlacements, type AnnexCell, type TextTables } from "@/lib/forms/text-tables";

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

/** Dónde va cada tabla en el Anexo III; `copiedRows`: filas de la plantilla copiadas por acciones y seguimientos. */
export function capaAnnexTablePlacements(tables: TextTables, copiedRows: Array<{ table: number; row: number; count: number }> = []) {
  return annexTablePlacements(tables, CAPA_TABLE_FIELDS, ANNEX_III_CELLS, copiedRows);
}
