import { DocumentType, QmsRecordType } from "@prisma/client";
import { requireStoredTemplate, TemplateAssetError } from "@/modules/configuration/template-assets";

export class CapaTemplateUnavailableError extends TemplateAssetError {}

export async function loadCapaAnnexIIITemplate(versionCode = "05") {
  return requireStoredTemplate(QmsRecordType.CAPA, DocumentType.CAPA_ANNEX_III, versionCode, "CAPA · Anexo III", CapaTemplateUnavailableError);
}

export async function loadCapaAnnexIVTemplate(versionCode = "05") {
  return requireStoredTemplate(QmsRecordType.CAPA, DocumentType.CAPA_ANNEX_IV, versionCode, "CAPA · Anexo IV", CapaTemplateUnavailableError);
}
