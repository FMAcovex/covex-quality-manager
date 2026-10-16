import type { QmsRecordType } from "@prisma/client";
import { qmsModuleByRecordType } from "@/modules/registry";

export function qmsRecordHref(_recordType: QmsRecordType | string, qmsRecordId: string) {
  return `/qms/${qmsRecordId}`;
}

export function qmsRecordTypeLabel(recordType: QmsRecordType | string) {
  return qmsModuleByRecordType(recordType)?.labels.singular ?? recordType;
}


export function qmsRecordDisplayCode(record: {
  businessCode?: string | null;
  annulledBusinessCode?: string | null;
}, fallback = "Sin código") {
  return record.businessCode ?? record.annulledBusinessCode ?? fallback;
}
