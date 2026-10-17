import { DocumentType,QmsRecordType } from "@prisma/client";

export const allowedDocumentTypes:Record<QmsRecordType,readonly DocumentType[]>={
  AUDIT:[],
  DEVIATION:[DocumentType.DEVIATION_ANNEX_III,DocumentType.DEVIATION_ANNEX_V],
  CAPA:[DocumentType.CAPA_ANNEX_III,DocumentType.CAPA_ANNEX_IV],
  CHANGE_CONTROL:[DocumentType.CHANGE_ANNEX_III,DocumentType.CHANGE_ANNEX_IV,DocumentType.CHANGE_ANNEX_V,DocumentType.CHANGE_ANNEX_VII],
  COMPLAINT:[DocumentType.COMPLAINT_ANNEX_III,DocumentType.COMPLAINT_ANNEX_IV,DocumentType.COMPLAINT_ANNEX_V],
  RETURN:[DocumentType.RETURN_ANNEX_III,DocumentType.RETURN_ANNEX_IV,DocumentType.RETURN_ANNEX_V,DocumentType.RETURN_ANNEX_VI],
  // Las plantillas de OOS (anexos III, IV y VI) llegan en OOS-3 (D-088).
  OOS:[],
};

export function isAllowedDocumentType(module:QmsRecordType,documentType:DocumentType){
  return allowedDocumentTypes[module].includes(documentType);
}
