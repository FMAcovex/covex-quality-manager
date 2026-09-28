import "server-only";
import { DocumentType, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";

export type TemplateAssetSummary = {
  module: QmsRecordType;
  documentType: DocumentType;
  versionCode: string;
  fileName?: string | null;
  filePath?: string | null;
  checksum?: string | null;
};

export const requiredControlledTemplates = [
  { module: QmsRecordType.DEVIATION, documentType: DocumentType.DEVIATION_ANNEX_III, versionCode: "06", label: "Desviaciones · Anexo III" },
  { module: QmsRecordType.DEVIATION, documentType: DocumentType.DEVIATION_ANNEX_V, versionCode: "06", label: "Desviaciones · Anexo V" },
  { module: QmsRecordType.CAPA, documentType: DocumentType.CAPA_ANNEX_III, versionCode: "05", label: "CAPA · Anexo III" },
  { module: QmsRecordType.CAPA, documentType: DocumentType.CAPA_ANNEX_IV, versionCode: "05", label: "CAPA · Anexo IV" },
  { module: QmsRecordType.CHANGE_CONTROL, documentType: DocumentType.CHANGE_ANNEX_III, versionCode: "03", label: "Controles de Cambios · Anexo III" },
  { module: QmsRecordType.CHANGE_CONTROL, documentType: DocumentType.CHANGE_ANNEX_IV, versionCode: "03", label: "Controles de Cambios · Anexo IV" },
  { module: QmsRecordType.CHANGE_CONTROL, documentType: DocumentType.CHANGE_ANNEX_V, versionCode: "03", label: "Controles de Cambios · Anexo V" },
  { module: QmsRecordType.CHANGE_CONTROL, documentType: DocumentType.CHANGE_ANNEX_VII, versionCode: "03", label: "Controles de Cambios · Anexo VII" },
  { module: QmsRecordType.COMPLAINT, documentType: DocumentType.COMPLAINT_ANNEX_III, versionCode: "03", label: "Reclamaciones · Anexo III v03" },
  { module: QmsRecordType.COMPLAINT, documentType: DocumentType.COMPLAINT_ANNEX_V, versionCode: "03", label: "Reclamaciones · Anexo V v03" },
  { module: QmsRecordType.RETURN, documentType: DocumentType.RETURN_ANNEX_III, versionCode: "03", label: "Devoluciones · Anexo III" },
  { module: QmsRecordType.RETURN, documentType: DocumentType.RETURN_ANNEX_IV, versionCode: "03", label: "Devoluciones · Anexo IV" },
  { module: QmsRecordType.RETURN, documentType: DocumentType.RETURN_ANNEX_V, versionCode: "03", label: "Devoluciones · Anexo V" },
  { module: QmsRecordType.RETURN, documentType: DocumentType.RETURN_ANNEX_VI, versionCode: "03", label: "Devoluciones · Anexo VI" },
] as const;

export function templateAssetReady(template: {
  fileName?: string | null;
  filePath?: string | null;
  checksum?: string | null;
} | null | undefined) {
  return Boolean((template?.fileName || template?.filePath) && template?.checksum);
}

export function evaluateRequiredTemplateReadiness(templates: TemplateAssetSummary[]) {
  const items = requiredControlledTemplates.map((required) => {
    const template = templates.find(
      (item) =>
        item.module === required.module &&
        item.documentType === required.documentType &&
        item.versionCode === required.versionCode,
    );
    return {
      ...required,
      ready: templateAssetReady(template),
      fileName: template?.fileName ?? null,
      checksum: template?.checksum ?? null,
    };
  });
  return {
    items,
    ready: items.filter((item) => item.ready).length,
    total: items.length,
    complete: items.every((item) => item.ready),
  };
}

export async function isActiveTemplateAssetReady(
  module: QmsRecordType,
  documentType: DocumentType,
) {
  const template = await prisma.templateVersion.findFirst({
    where: { module, documentType, isActive: true },
    orderBy: { effectiveFrom: "desc" },
    select: { fileName: true, filePath: true, checksum: true },
  });
  return templateAssetReady(template);
}
