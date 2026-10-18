import { DocumentType, QmsRecordType } from "@prisma/client";
import { requireStoredTemplate, TemplateAssetError } from "@/modules/configuration/template-assets";

export class ChangeControlTemplateUnavailableError extends TemplateAssetError {}

const load = (documentType: DocumentType, versionCode: string, label: string) =>
  requireStoredTemplate(QmsRecordType.CHANGE_CONTROL, documentType, versionCode, `Controles de cambios · ${label}`, ChangeControlTemplateUnavailableError);

export async function loadChangeAnnexIIITemplate(versionCode = "03") {
  return load(DocumentType.CHANGE_ANNEX_III, versionCode, "Anexo III");
}

export async function loadChangeAnnexIVTemplate(versionCode = "03") {
  return load(DocumentType.CHANGE_ANNEX_IV, versionCode, "Anexo IV");
}

export async function loadChangeAnnexVTemplate(versionCode = "03") {
  return load(DocumentType.CHANGE_ANNEX_V, versionCode, "Anexo V");
}

export async function loadChangeAnnexVIITemplate(versionCode = "03") {
  return load(DocumentType.CHANGE_ANNEX_VII, versionCode, "Anexo VII");
}
