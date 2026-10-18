import { DocumentType,QmsRecordType } from "@prisma/client";
import { requireStoredTemplate, TemplateAssetError } from "@/modules/configuration/template-assets";

export class ComplaintTemplateUnavailableError extends TemplateAssetError {}

// v03: un archivo por anexo. v02 (histórica): el PNT completo, del que el generador recorta cada anexo.
export async function loadComplaintPntTemplate(versionCode="03",documentType:DocumentType=DocumentType.COMPLAINT_ANNEX_III){
 return requireStoredTemplate(QmsRecordType.COMPLAINT,documentType,versionCode,`Reclamaciones · ${documentType.replace("COMPLAINT_ANNEX_","Anexo ")}`,ComplaintTemplateUnavailableError);
}
