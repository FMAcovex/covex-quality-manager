import { numberTextTables, type TextTables } from "@/lib/forms/text-tables";

// D-127: campos de texto largo de Desviaciones que admiten tablas, en el orden en que se numeran
// (el de los apartados del formulario y del Anexo III). Las observaciones internas no van al anexo.
export const DEVIATION_TABLE_FIELDS = [
  "affectedDocumentation",
  "whatHappened",
  "whoInvolved",
  "whenHappened",
  "whereHappened",
  "howHappened",
  "investigation",
  "rootCause",
  "recurrenceDetails",
  "otherProcessesImpactDetails",
  "conclusion",
  "dispositionComments",
  "internalObservations",
] as const;

/** Casilla del Anexo III de cada campo (tabla, fila, celda de la plantilla); null si no va al anexo. */
const ANNEX_III_CELLS: Record<(typeof DEVIATION_TABLE_FIELDS)[number], { table: number; row: number; cell: number } | null> = {
  affectedDocumentation: { table: 0, row: 18, cell: 0 },
  whatHappened: { table: 1, row: 2, cell: 0 },
  whoInvolved: { table: 1, row: 4, cell: 0 },
  whenHappened: { table: 1, row: 6, cell: 0 },
  whereHappened: { table: 1, row: 8, cell: 0 },
  howHappened: { table: 1, row: 10, cell: 0 },
  investigation: { table: 2, row: 6, cell: 0 },
  rootCause: { table: 2, row: 14, cell: 0 },
  recurrenceDetails: { table: 2, row: 16, cell: 1 },
  otherProcessesImpactDetails: { table: 3, row: 6, cell: 1 },
  conclusion: { table: 4, row: 1, cell: 0 },
  dispositionComments: { table: 4, row: 3, cell: 0 },
  internalObservations: null,
};

export function numberDeviationTables(tables: TextTables) {
  return numberTextTables(tables, DEVIATION_TABLE_FIELDS);
}

/** Dónde va cada tabla en el Anexo III. */
export function deviationAnnexTablePlacements(tables: TextTables) {
  const numbered = numberDeviationTables(tables);
  return DEVIATION_TABLE_FIELDS.flatMap((field) => {
    const cell = ANNEX_III_CELLS[field];
    const items = numbered[field];
    return cell && items?.length ? [{ ...cell, tables: items }] : [];
  });
}
