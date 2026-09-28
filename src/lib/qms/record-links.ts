import type { QmsRecordType } from "@prisma/client";

export function qmsRecordHref(_recordType: QmsRecordType | string, qmsRecordId: string) {
  return `/qms/${qmsRecordId}`;
}

export function qmsRecordTypeLabel(recordType: QmsRecordType | string) {
  if (recordType === "DEVIATION") return "Desviación";
  if (recordType === "CAPA") return "CAPA";
  if (recordType === "CHANGE_CONTROL") return "Control de Cambio";
  if (recordType === "COMPLAINT") return "Reclamación";
  if (recordType === "RETURN") return "Devolución";
  return recordType;
}
