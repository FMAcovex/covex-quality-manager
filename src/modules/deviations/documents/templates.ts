import { DocumentType, QmsRecordType } from "@prisma/client";
import { requireStoredTemplate, TemplateAssetError } from "@/modules/configuration/template-assets";

export class TemplateUnavailableError extends TemplateAssetError {}

/** Versión del Anexo III que usa el generador cuando el expediente no tiene una plantilla asignada. */
export const DEFAULT_DEVIATION_ANNEX_III_VERSION = "06";

export async function loadAnnexIIITemplate(versionCode = DEFAULT_DEVIATION_ANNEX_III_VERSION) {
  return requireStoredTemplate(QmsRecordType.DEVIATION, DocumentType.DEVIATION_ANNEX_III, versionCode, "Desviaciones · Anexo III", TemplateUnavailableError);
}

export async function loadAnnexVTemplate(versionCode = "06") {
  return requireStoredTemplate(QmsRecordType.DEVIATION, DocumentType.DEVIATION_ANNEX_V, versionCode, "Desviaciones · Anexo V", TemplateUnavailableError);
}
