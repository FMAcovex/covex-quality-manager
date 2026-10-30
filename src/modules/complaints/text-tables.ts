import { annexTablePlacements, type AnnexCell, type TextTables } from "@/lib/forms/text-tables";

// D-127: campos de texto largo de Reclamaciones que admiten tablas, en el orden en que se numeran (el del
// formulario y del Anexo III). Las observaciones internas no van al anexo; el Anexo IV (comunicación al
// cliente o proveedor) no lleva tablas.
export const COMPLAINT_TABLE_FIELDS = [
  "description",
  "attachedDocumentation",
  "riskJustification",
  "investigation",
  "impactAssessment",
  "rootCause",
  "regulatoryJustification",
  "resolutionLines",
  "immediateActionDetails",
  "recallActionDetails",
  "creditActionDetails",
  "replacementActionDetails",
  "otherResolutionDetails",
  "communicationSummary",
  "conclusion",
  "responseSummary",
  "effectivenessAssessment",
  "closeConclusion",
  "internalObservations",
] as const;

type Field = (typeof COMPLAINT_TABLE_FIELDS)[number];

/** Nombre de cada campo, para los mensajes del resumen de errores. */
export const COMPLAINT_TABLE_FIELD_LABELS: Record<Field, string> = {
  description: "Descripción",
  attachedDocumentation: "Evidencias / documentación",
  riskJustification: "Justificación de riesgo",
  investigation: "Investigación",
  impactAssessment: "Evaluación del impacto",
  rootCause: "Causa raíz",
  regulatoryJustification: "Justificación regulatoria",
  resolutionLines: "Líneas de actuación",
  immediateActionDetails: "Acción inmediata",
  recallActionDetails: "Retirada del mercado",
  creditActionDetails: "Abono",
  replacementActionDetails: "Reposición",
  otherResolutionDetails: "Otras actuaciones",
  communicationSummary: "Comunicación",
  conclusion: "Conclusión Parte I",
  responseSummary: "Respuesta",
  effectivenessAssessment: "Verificación de eficacia",
  closeConclusion: "Conclusión de cierre",
  internalObservations: "Observaciones internas",
};

const resolutionRight = { table: 1, row: 52, cell: 1 };
/** Casillas del Anexo III v03 (vigente). */
const ANNEX_III_V03: Partial<Record<Field, AnnexCell>> = {
  description: { table: 1, row: 13, cell: 0 },
  attachedDocumentation: { table: 1, row: 15, cell: 1 },
  riskJustification: { table: 1, row: 28, cell: 0 },
  investigation: { table: 1, row: 31, cell: 0 },
  impactAssessment: { table: 1, row: 31, cell: 0 },
  rootCause: { table: 1, row: 35, cell: 0 },
  regulatoryJustification: { table: 1, row: 47, cell: 1 },
  resolutionLines: { table: 1, row: 50, cell: 0 },
  immediateActionDetails: { table: 1, row: 52, cell: 0 },
  recallActionDetails: resolutionRight,
  creditActionDetails: resolutionRight,
  replacementActionDetails: resolutionRight,
  otherResolutionDetails: resolutionRight,
  communicationSummary: { table: 1, row: 59, cell: 0 },
  conclusion: { table: 1, row: 63, cell: 0 },
  responseSummary: { table: 3, row: 4, cell: 0 },
  effectivenessAssessment: { table: 3, row: 8, cell: 0 },
  closeConclusion: { table: 3, row: 12, cell: 0 },
};

/**
 * Casillas de las plantillas del Anexo III anteriores a la v03 (sin las casillas que no tienen). Los detalles
 * de cada actuación no se imprimen en ellas, así que sus tablas tampoco.
 */
const ANNEX_III_LEGACY: Partial<Record<Field, AnnexCell>> = {
  description: { table: 1, row: 10, cell: 0 },
  attachedDocumentation: { table: 1, row: 12, cell: 1 },
  investigation: { table: 1, row: 16, cell: 0 },
  impactAssessment: { table: 1, row: 16, cell: 0 },
  rootCause: { table: 2, row: 1, cell: 0 },
  resolutionLines: { table: 2, row: 8, cell: 0 },
  conclusion: { table: 3, row: 1, cell: 0 },
  responseSummary: { table: 5, row: 2, cell: 0 },
  closeConclusion: { table: 5, row: 7, cell: 0 },
};

/** Actuación de la que depende cada detalle; su texto solo se imprime con la actuación marcada. */
const DETAIL_ACTIONS: Partial<Record<Field, string>> = {
  immediateActionDetails: "IMMEDIATE_ACTION",
  recallActionDetails: "RECALL",
  creditActionDetails: "CREDIT",
  replacementActionDetails: "REPLACEMENT",
  otherResolutionDetails: "OTHER",
};
/** Actuaciones con casilla propia en la v03; las demás se imprimen en «Otros». */
const BOXED_ACTIONS = new Set(["RETURN", "CORRECTIVE_ACTION", "PREVENTIVE_ACTION", "IMMEDIATE_ACTION", "RECALL", "CREDIT", "REPLACEMENT", "OTHER"]);

/**
 * Dónde va cada tabla en el Anexo III según la plantilla (`v03` o anterior). `linkedRows`: filas que la
 * plantilla copia (acciones vinculadas en la v03, CAPA en las anteriores; al menos una). Las tablas de un
 * detalle de actuación siguen a su texto: solo salen con la actuación marcada («Otros», también con
 * actuaciones sin casilla propia). La numeración sigue siendo la de todo el expediente.
 */
export function complaintAnnexTablePlacements(tables: TextTables, mapping: "v03" | "legacy", linkedRows: number, resolutionActions: readonly string[]) {
  const copied = mapping === "v03" ? { table: 1, row: 55, count: linkedRows } : { table: 2, row: 13, count: linkedRows };
  const selected = new Set(resolutionActions);
  const printed = (action: string) => selected.has(action) || (action === "OTHER" && resolutionActions.some((item) => !BOXED_ACTIONS.has(item)));
  const cells = { ...(mapping === "v03" ? ANNEX_III_V03 : ANNEX_III_LEGACY) };
  for (const [field, action] of Object.entries(DETAIL_ACTIONS) as [Field, string][]) if (!printed(action)) delete cells[field];
  return annexTablePlacements(tables, COMPLAINT_TABLE_FIELDS, cells, [copied]);
}
