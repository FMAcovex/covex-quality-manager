import { annexTablePlacements, type AnnexCell, type TextTables } from "@/lib/forms/text-tables";

// D-127: campos de texto largo de OOS que admiten tablas, en el orden en que se numeran (Fase I, Anexo III;
// Fase II, Anexo IV). Las observaciones internas no van al anexo.
export const OOS_TABLE_FIELDS = [
  "detectionDescription",
  "phaseIInvestigation",
  "phaseIConclusion",
  "phaseIIProductionReview",
  "phaseIIRetesting",
  "phaseIIResampling",
  "phaseIIConclusion",
  "phaseIIAffectedDepartments",
  "internalObservations",
] as const;

type Field = (typeof OOS_TABLE_FIELDS)[number];

/** Nombre de cada campo, para los mensajes del resumen de errores. */
export const OOS_TABLE_FIELD_LABELS: Record<Field, string> = {
  detectionDescription: "Descripción de la detección",
  phaseIInvestigation: "Investigación de Fase I",
  phaseIConclusion: "Conclusiones de Fase I",
  phaseIIProductionReview: "Revisión de la producción",
  phaseIIRetesting: "Repetición de pruebas",
  phaseIIResampling: "Remuestreo",
  phaseIIConclusion: "Conclusión de la investigación",
  phaseIIAffectedDepartments: "Departamentos afectados",
  internalObservations: "Observaciones internas",
};

/** Casillas del Anexo III (Fase I) y del Anexo IV (Fase II). Ninguno copia filas. */
const ANNEX_CELLS: Record<"III" | "IV", Partial<Record<Field, AnnexCell>>> = {
  III: {
    detectionDescription: { table: 0, row: 13, cell: 0 },
    phaseIInvestigation: { table: 2, row: 2, cell: 0 },
    phaseIConclusion: { table: 2, row: 4, cell: 0 },
  },
  IV: {
    phaseIIProductionReview: { table: 0, row: 3, cell: 0 },
    phaseIIRetesting: { table: 0, row: 5, cell: 0 },
    phaseIIResampling: { table: 0, row: 7, cell: 0 },
    phaseIIConclusion: { table: 1, row: 2, cell: 0 },
    phaseIIAffectedDepartments: { table: 1, row: 9, cell: 0 },
  },
};

/** Dónde va cada tabla en el anexo indicado; la numeración es la de todo el expediente. */
export function oosAnnexTablePlacements(tables: TextTables, annex: "III" | "IV") {
  return annexTablePlacements(tables, OOS_TABLE_FIELDS, ANNEX_CELLS[annex]);
}
