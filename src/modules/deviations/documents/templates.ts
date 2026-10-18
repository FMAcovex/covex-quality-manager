import { DocumentType, QmsRecordType } from "@prisma/client";
import { requireStoredTemplate, TemplateAssetError } from "@/modules/configuration/template-assets";

export class TemplateUnavailableError extends TemplateAssetError {}

export async function loadAnnexIIITemplate(versionCode = "06") {
  return requireStoredTemplate(QmsRecordType.DEVIATION, DocumentType.DEVIATION_ANNEX_III, versionCode, "Desviaciones · Anexo III", TemplateUnavailableError);
}

export async function loadAnnexVTemplate(versionCode = "06") {
  return requireStoredTemplate(QmsRecordType.DEVIATION, DocumentType.DEVIATION_ANNEX_V, versionCode, "Desviaciones · Anexo V", TemplateUnavailableError);
}
