import { DocumentType, QmsRecordType } from "@prisma/client";
import { requireStoredTemplate, TemplateAssetError } from "@/modules/configuration/template-assets";

export class CapaTemplateUnavailableError extends TemplateAssetError {}

/** Versión del Anexo III que usa el generador cuando la CAPA no tiene una plantilla asignada. */
export const DEFAULT_CAPA_ANNEX_III_VERSION = "05";

export async function loadCapaAnnexIIITemplate(versionCode = DEFAULT_CAPA_ANNEX_III_VERSION) {
  return requireStoredTemplate(QmsRecordType.CAPA, DocumentType.CAPA_ANNEX_III, versionCode, "CAPA · Anexo III", CapaTemplateUnavailableError);
}

export async function loadCapaAnnexIVTemplate(versionCode = "05") {
  return requireStoredTemplate(QmsRecordType.CAPA, DocumentType.CAPA_ANNEX_IV, versionCode, "CAPA · Anexo IV", CapaTemplateUnavailableError);
}
