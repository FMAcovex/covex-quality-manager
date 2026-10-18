import { DocumentType,QmsRecordType } from "@prisma/client";
import { requireStoredTemplate, TemplateAssetError } from "@/modules/configuration/template-assets";

export class ReturnTemplateUnavailableError extends TemplateAssetError {}

export async function loadReturnPntTemplate(versionCode="03",documentType:DocumentType=DocumentType.RETURN_ANNEX_III){
 return requireStoredTemplate(QmsRecordType.RETURN,documentType,versionCode,`Devoluciones · ${documentType.replace("RETURN_ANNEX_","Anexo ")}`,ReturnTemplateUnavailableError);
}
