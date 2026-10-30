import { annexTablePlacements, type AnnexCell, type TextTables } from "@/lib/forms/text-tables";

// D-127: campos de texto largo de Devoluciones que admiten tablas, en el orden en que se numeran (el del
// formulario). El certificado de destrucción y las observaciones internas no van al anexo; los comentarios
// de seguimiento y las observaciones de recepción de cada producto no admiten tablas.
export const RETURN_TABLE_FIELDS = [
  "reasonObservations",
  "attachedDocumentation",
  "ambientPeriodRiskJustification",
  "finalDestination",
  "decisionObservations",
  "destructionCertificate",
  "customerDeclarationObservations",
  "internalObservations",
] as const;

type Field = (typeof RETURN_TABLE_FIELDS)[number];

/** Nombre de cada campo, para los mensajes del resumen de errores. */
export const RETURN_TABLE_FIELD_LABELS: Record<Field, string> = {
  reasonObservations: "Observaciones del motivo",
  attachedDocumentation: "Documentación",
  ambientPeriodRiskJustification: "Justificación del plazo excepcional",
  finalDestination: "Destino final",
  decisionObservations: "Observaciones de la decisión",
  destructionCertificate: "Certificado de destrucción",
  customerDeclarationObservations: "Declaración del cliente",
  internalObservations: "Observaciones internas",
};

const decision = { table: 7, row: 1, cell: 1 };
/** Casillas del Anexo III (informe) y del Anexo V (declaración del cliente). */
const ANNEX_CELLS: Record<"III" | "V", Partial<Record<Field, AnnexCell>>> = {
  III: {
    reasonObservations: { table: 4, row: 0, cell: 0 },
    attachedDocumentation: { table: 4, row: 0, cell: 0 },
    ambientPeriodRiskJustification: decision,
    finalDestination: decision,
    decisionObservations: decision,
  },
  V: { customerDeclarationObservations: { table: 3, row: 0, cell: 0 } },
};

/** Dónde va cada tabla en el anexo indicado; el Anexo III copia la fila de productos (tabla 3, fila 1). */
export function returnAnnexTablePlacements(tables: TextTables, annex: "III" | "V", products = 0) {
  return annexTablePlacements(tables, RETURN_TABLE_FIELDS, ANNEX_CELLS[annex], annex === "III" ? [{ table: 3, row: 1, count: products }] : []);
}
