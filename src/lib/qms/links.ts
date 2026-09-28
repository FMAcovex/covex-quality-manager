import type { QmsRecordType } from "@prisma/client";

export type LinkableQmsRecord = {
  id: string;
  recordType: QmsRecordType | string;
  businessCode: string | null;
  deviation?: { id: string } | null;
  capa?: { id: string } | null;
  changeControl?: { id: string } | null;
  complaint?: { id: string } | null;
  returnRecord?: { id: string } | null;
};

export function qmsRecordHref(record: LinkableQmsRecord) {
  if (record.recordType === "DEVIATION" && record.deviation) return `/deviations/${record.deviation.id}`;
  if (record.recordType === "CAPA" && record.capa) return `/capa/${record.capa.id}`;
  if (record.recordType === "CHANGE_CONTROL" && record.changeControl) return `/changes/${record.changeControl.id}`;
  if (record.recordType === "COMPLAINT" && record.complaint) return `/complaints/${record.complaint.id}`;
  if (record.recordType === "RETURN" && record.returnRecord) return `/returns/${record.returnRecord.id}`;
  return null;
}

export function qmsRecordTypeLabel(type: string) {
  if (type === "DEVIATION") return "Desviación";
  if (type === "CAPA") return "CAPA";
  if (type === "CHANGE_CONTROL") return "Control de cambio";
  if (type === "COMPLAINT") return "Reclamación";
  if (type === "RETURN") return "Devolución";
  return type;
}
