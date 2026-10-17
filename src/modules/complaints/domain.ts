export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone:"UTC" }).format(date);
}

export function complaintTypeLabel(value: string | null | undefined) {
  if (value === "PROVIDER") return "A proveedor";
  if (value === "CUSTOMER") return "De cliente";
  return "Sin indicar";
}

export function complaintClassificationLabel(value: string | null | undefined) {
  if (value === "CRITICAL") return "Crítica";
  if (value === "MAJOR") return "Mayor";
  if (value === "MINOR") return "Menor";
  if (value === "NO_GMP_IMPACT") return "Sin impacto GMP";
  return "Sin clasificar";
}

export function complaintStatusLabel(value: string) {
  if (value === "DRAFT") return "Borrador";
  return value === "CLOSED" ? "Cerrada" : "Abierta";
}

export function complaintEffectivenessLabel(value: string) {
  if (value === "ACCEPTABLE") return "Conforme";
  if (value === "NOT_ACCEPTABLE") return "No conforme";
  if (value === "NOT_REQUIRED") return "N/A";
  return "Pendiente";
}

export type ComplaintOperationalSituation =
  | "DRAFT"
  | "PART_I"
  | "PART_II_DECISION_PENDING"
  | "PART_I_CLOSURE_PENDING"
  | "PART_II"
  | "EFFECTIVENESS_PENDING"
  | "EFFECTIVENESS_NONCONFORMING"
  | "CLOSED";

export function complaintOperationalSituation(record: {
  status: string;
  partIIRequired: boolean | null;
  conclusion?: string | null;
  responseSummary?: string | null;
  effectivenessStatus: string;
}): ComplaintOperationalSituation {
  if (record.status === "DRAFT") return "DRAFT";
  if (record.status === "CLOSED") return "CLOSED";
  if (record.partIIRequired === false) return "PART_I_CLOSURE_PENDING";
  if (record.partIIRequired === null) {
    return record.conclusion?.trim() ? "PART_II_DECISION_PENDING" : "PART_I";
  }
  if (!record.responseSummary?.trim()) return "PART_II";
  if (record.effectivenessStatus === "NOT_ACCEPTABLE") return "EFFECTIVENESS_NONCONFORMING";
  if (record.effectivenessStatus === "PENDING") return "EFFECTIVENESS_PENDING";
  return "PART_II";
}

export function complaintOperationalSituationLabel(value: ComplaintOperationalSituation) {
  if (value === "DRAFT") return "Borrador";
  if (value === "PART_I") return "Parte I en curso";
  if (value === "PART_II_DECISION_PENDING") return "Pendiente decisión Parte II";
  if (value === "PART_I_CLOSURE_PENDING") return "Pendiente cierre Parte I";
  if (value === "PART_II") return "Parte II / seguimiento";
  if (value === "EFFECTIVENESS_PENDING") return "Pendiente eficacia";
  if (value === "EFFECTIVENESS_NONCONFORMING") return "Eficacia no conforme";
  return "Cerrada";
}

export function complaintOperationalSituationTone(value: ComplaintOperationalSituation) {
  if (value === "CLOSED") return "closed";
  if (value === "EFFECTIVENESS_NONCONFORMING") return "nonconforming";
  if (value === "PART_II_DECISION_PENDING" || value === "PART_I_CLOSURE_PENDING" || value === "EFFECTIVENESS_PENDING") return "warning";
  if (value === "DRAFT") return "neutral";
  return "open";
}

export function complaintFollowupState(record: {
  status: string;
  nextFollowupDate?: Date | string | null;
}, now = new Date()) {
  if (record.status !== "OPEN") return "NONE" as const;
  if (!record.nextFollowupDate) return "MISSING" as const;
  const due = record.nextFollowupDate instanceof Date ? record.nextFollowupDate : new Date(record.nextFollowupDate);
  return due.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    ? "OVERDUE" as const
    : "PENDING" as const;
}

export function investigationResultLabel(value: string | null | undefined) {
  if (value === "PROCEDENT") return "Procedente";
  if (value === "NOT_PROCEDENT") return "No procedente";
  if (value === "INCONCLUSIVE") return "No concluyente";
  if (value === "NOT_ATTRIBUTABLE_TO_COVEX") return "No atribuible a COVEX";
  return "Pendiente";
}

// Opciones de los grupos «Origen / fuente» y «Categoría / motivo» del formulario;
// se reutilizan en Indicadores para rotular el Pareto.
export const complaintSourceOptions=[["CUSTOMER","Cliente"],["DISTRIBUTOR","Distribuidor"],["MAH","Titular / MAH"],["CONSUMER","Consumidor / usuario"],["AUTHORITY","Autoridad / entidad sanitaria"],["SUPPLIER","Proveedor"],["CARRIER","Transportista / operador logístico"],["SUBCONTRACTOR","Subcontrata"],["INTERNAL","Detección interna"],["RECALL","Retirada"],["OTHER","Otro"]] as const;
export const complaintCategoryOptions=[["PRODUCT_QUALITY","Calidad del producto"],["SPECIFICATIONS_TESTING","Especificaciones / análisis"],["PACKAGING","Acondicionamiento / envase"],["LABELLING_DOCUMENTATION","Etiquetado / documentación"],["QUANTITY_CONTENT","Cantidad / contenido"],["TRANSPORT_STORAGE","Transporte / almacenamiento"],["SERVICE_SUPPLY","Servicio / suministro"],["EQUIPMENT_SYSTEM","Equipo / sistema"],["ENVIRONMENT","Medio ambiente"],["OTHER","Otro"]] as const;
