import type { QmsRecordType } from "@prisma/client";

export function qmsRecordHref(recordType: QmsRecordType | string, id: string) {
  if (recordType === "DEVIATION") return `/deviations/${id}`;
  if (recordType === "CAPA") return `/capa/${id}`;
  if (recordType === "CHANGE_CONTROL") return `/change-controls/${id}`;
  if (recordType === "COMPLAINT") return `/complaints/${id}`;
  if (recordType === "RETURN") return `/returns/${id}`;
  return "#";
}

export function qmsRecordTypeLabel(recordType: QmsRecordType | string) {
  if (recordType === "DEVIATION") return "Desviación";
  if (recordType === "CAPA") return "CAPA";
  if (recordType === "CHANGE_CONTROL") return "Control de Cambio";
  if (recordType === "COMPLAINT") return "Reclamación";
  if (recordType === "RETURN") return "Devolución";
  return recordType;
}
