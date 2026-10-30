import { annexTablePlacements, type AnnexCell, type TextTables } from "@/lib/forms/text-tables";

// D-127: campos de texto largo de Controles de cambios que admiten tablas, en el orden en que se numeran
// (el del formulario: solicitud, Anexo III; dictamen, Anexo IV). Las observaciones internas no van al anexo.
export const CHANGE_CONTROL_TABLE_FIELDS = [
  "description",
  "justification",
  "providedDocuments",
  "evaluation",
  "dictamenObservations",
  "internalObservations",
] as const;

/** Nombre de cada campo, para los mensajes del resumen de errores. */
export const CHANGE_CONTROL_TABLE_FIELD_LABELS: Record<(typeof CHANGE_CONTROL_TABLE_FIELDS)[number], string> = {
  description: "Descripción del cambio",
  justification: "Justificación del cambio",
  providedDocuments: "Documentos que se aportan",
  evaluation: "Evaluación del cambio",
  dictamenObservations: "Observaciones del dictamen",
  internalObservations: "Observaciones internas",
};

type Field = (typeof CHANGE_CONTROL_TABLE_FIELDS)[number];

/** Casillas de la solicitud (Anexo III). */
const ANNEX_III_CELLS: Partial<Record<Field, AnnexCell>> = {
  description: { table: 0, row: 7, cell: 0 },
  justification: { table: 0, row: 9, cell: 0 },
  providedDocuments: { table: 0, row: 11, cell: 0 },
};

/** Casillas del dictamen (Anexo IV). Las tareas solo copian filas de la tabla 1, sin tablas de textos. */
const ANNEX_IV_CELLS: Partial<Record<Field, AnnexCell>> = {
  evaluation: { table: 0, row: 5, cell: 0 },
  dictamenObservations: { table: 2, row: 5, cell: 1 },
};

/** Dónde va cada tabla en el anexo indicado; la numeración es la de todo el expediente. */
export function changeControlAnnexTablePlacements(tables: TextTables, annex: "III" | "IV") {
  return annexTablePlacements(tables, CHANGE_CONTROL_TABLE_FIELDS, annex === "III" ? ANNEX_III_CELLS : ANNEX_IV_CELLS);
}
