import "server-only";
import type { DocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AccessError, currentIdentity, type AccessModule, type AccessPermission } from "@/lib/auth/context";
import { assertPermission } from "@/lib/auth/policy";
import { resourceScope } from "@/lib/auth/resources";
import { versionLabel } from "@/lib/qms/versioning";
import { loadStoredTemplateAsset } from "@/modules/configuration/template-assets";
import { parseTrialReference, TemplateTrialError, trialFileName, trialKind } from "@/modules/configuration/template-trial-rules";
import { generateAnnexIII } from "@/modules/deviations/documents/annex-iii";
import { generateAnnexV } from "@/modules/deviations/documents/xlsx";
import { getDeviationDetail } from "@/modules/deviations/queries";
import { getDeviationExportRows } from "@/modules/deviations/documents/export-data";
import { generateCapaAnnexIII } from "@/modules/capa/documents/annex-iii";
import { generateCapaAnnexIV } from "@/modules/capa/documents/xlsx";
import { getCapaDetail } from "@/modules/capa/queries";
import { getCapaExportRows } from "@/modules/capa/documents/export-data";
import { generateChangeAnnexIII } from "@/modules/change-control/documents/annex-iii";
import { generateChangeAnnexIV } from "@/modules/change-control/documents/annex-iv";
import { generateChangeAnnexV } from "@/modules/change-control/documents/annex-v";
import { generateChangeAnnexVII } from "@/modules/change-control/documents/xlsx";
import { getChangeControlDetail } from "@/modules/change-control/queries";
import { getChangeControlExportRows } from "@/modules/change-control/documents/export-data";
import { generateComplaintAnnexIII, generateComplaintAnnexIV } from "@/modules/complaints/documents/docx";
import { generateComplaintAnnexV } from "@/modules/complaints/documents/xlsx";
import { getComplaintDetail } from "@/modules/complaints/queries";
import { getComplaintExportRows } from "@/modules/complaints/documents/export-data";
import { generateReturnAnnexIII, generateReturnAnnexIV, generateReturnAnnexV } from "@/modules/returns/documents/docx";
import { generateReturnAnnexVI } from "@/modules/returns/documents/xlsx";
import { getReturnDetail } from "@/modules/returns/queries";
import { getReturnExportRows } from "@/modules/returns/documents/export-data";
import { fillOosAnnexIII, fillOosAnnexIV, fillOosAnnexVI } from "@/modules/oos/documents/docx";
import { getOosAnnexVIRecords, getOosDetail } from "@/modules/oos/queries";
import { generateAuditCapaPlan, generateAuditExternalPlan, generateAuditReport } from "@/modules/audits/documents/generators";
import { generateAnnualProgramme } from "@/modules/audits/annual-programme/generator";
import { getProgrammePreview } from "@/modules/audits/annual-programme/service";
import { auditReportInclude, snapshotAudit } from "@/modules/audits/report-service";

const WORD = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const EXCEL = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type TemplateTrialFile = { buffer: Buffer; fileName: string; mimeType: string };

// Modelo de cada módulo con expedientes y nombre de su campo de estado (Cambios usa `finalStatus`).
const RECORD_MODELS = {
  DEVIATION: { delegate: "deviation", status: "status", label: "Desviaciones" },
  CAPA: { delegate: "capa", status: "status", label: "CAPA" },
  CHANGE_CONTROL: { delegate: "changeControl", status: "finalStatus", label: "Controles de cambios" },
  COMPLAINT: { delegate: "complaint", status: "status", label: "Reclamaciones" },
  RETURN: { delegate: "returnRecord", status: "status", label: "Devoluciones" },
  OOS: { delegate: "oosRecord", status: "status", label: "OOS" },
  AUDIT: { delegate: "audit", status: "status", label: "Auditorías" },
} as const;
type RecordModule = keyof typeof RECORD_MODELS;
type RecordRow = { id: string; status: string; qmsRecord: { businessCode: string | null; isActive: boolean } };
type FindDelegate = { findFirst(args: object): Promise<Record<string, unknown> | null> };

function principal() {
  const user = currentIdentity()?.principal;
  if (!user) throw new AccessError(401);
  return user;
}

/** La prueba exige los mismos permisos que la descarga normal de ese anexo, además de gestionar la configuración. */
async function requireRecordAccess(module: RecordModule, id: string) {
  const scope = await resourceScope(module as AccessModule, id);
  for (const permission of ["DOWNLOAD", "GENERATE_DOCUMENT"] as AccessPermission[]) assertPermission(principal(), module as AccessModule, permission, scope);
}

/**
 * Expediente con el que se prueba: el indicado por su código o, si no se indica, el último modificado que no
 * esté en borrador ni anulado y cumpla `extra` (por ejemplo, un control de cambio con seguimientos).
 */
async function pickRecord(module: RecordModule, code: string | null, extra: Record<string, unknown> = {}, missing?: string): Promise<RecordRow> {
  const model = RECORD_MODELS[module];
  const delegate = (prisma as unknown as Record<string, FindDelegate>)[model.delegate];
  const select = { id: true, [model.status]: true, qmsRecord: { select: { businessCode: true, isActive: true } } };
  const read = (row: Record<string, unknown> | null) => row ? { ...(row as unknown as RecordRow), status: String(row[model.status]) } : null;
  if (code) {
    const found = read(await delegate.findFirst({ where: { qmsRecord: { businessCode: { equals: code, mode: "insensitive" } } }, select }));
    if (!found) throw new TemplateTrialError(`No hay ningún expediente de ${model.label} con el código «${code}».`, 404);
    if (!found.qmsRecord.isActive) throw new TemplateTrialError(`El expediente ${code} está anulado; prueba con otro.`);
    if (found.status === "DRAFT") throw new TemplateTrialError(`El expediente ${code} está en borrador y sus documentos no se generan; prueba con otro.`);
    if (Object.keys(extra).length && !(await delegate.findFirst({ where: { id: found.id, ...extra }, select: { id: true } }))) throw new TemplateTrialError(missing ?? `El expediente ${code} no sirve para este documento.`);
    return found;
  }
  const latest = read(await delegate.findFirst({
    // Con código de negocio, para que el nombre del archivo diga con qué expediente se ha probado.
    where: { [model.status]: { not: "DRAFT" }, qmsRecord: { isActive: true, businessCode: { not: null } }, ...extra },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select,
  }));
  if (!latest) throw new TemplateTrialError(missing ?? `No hay ningún expediente de ${model.label} fuera de borrador con el que probar la plantilla.`);
  return latest;
}

function required<T>(value: T | null | undefined, message = "El expediente ya no existe."): T {
  if (!value) throw new TemplateTrialError(message, 404);
  return value;
}

const latestSequence = (record: { qmsRecord: { versions: Array<{ sequenceNumber: number }> } }) => record.qmsRecord.versions.at(-1)?.sequenceNumber ?? 0;

/**
 * D-129: genera un anexo con una versión concreta de su plantilla (activa o no) y un expediente real, con los
 * mismos generadores que las descargas. No guarda nada: ni documento de trabajo ni recibo; el archivo se llama
 * «PRUEBA_…». Se usa el estado actual del expediente, sin figuras.
 */
export async function generateTemplateTrial(templateId: string, rawReference: string | null): Promise<TemplateTrialFile> {
  const template = await prisma.templateVersion.findUnique({ where: { id: templateId }, select: { module: true, documentType: true, versionCode: true } });
  if (!template) throw new TemplateTrialError("La plantilla no existe.", 404);
  const { module, documentType, versionCode } = template;
  if (!trialKind(documentType)) throw new TemplateTrialError("Este documento no tiene una plantilla que se pueda probar con un expediente.", 400);
  const reference = parseTrialReference(documentType, rawReference);
  const bytes = await loadStoredTemplateAsset(module, documentType, versionCode);
  if (!bytes) throw new TemplateTrialError("Esta versión no tiene archivo de plantilla guardado. Instálala de nuevo antes de probarla.");
  const version = { versionCode };
  const word = (buffer: Buffer, subject: string): TemplateTrialFile => ({ buffer, fileName: trialFileName(documentType, versionCode, subject, "docx"), mimeType: WORD });
  const excel = (buffer: Buffer, subject: string): TemplateTrialFile => ({ buffer, fileName: trialFileName(documentType, versionCode, subject, "xlsx"), mimeType: EXCEL });
  const record = async (recordModule: RecordModule, extra?: Record<string, unknown>, missing?: string) => {
    if (reference.kind !== "record") throw new TemplateTrialError("Este documento se prueba con un año.", 400);
    const row = await pickRecord(recordModule, reference.code, extra, missing);
    await requireRecordAccess(recordModule, row.id);
    return { id: row.id, code: row.qmsRecord.businessCode ?? row.id };
  };
  const year = () => {
    if (reference.kind !== "year") throw new TemplateTrialError("Este documento se prueba con un expediente.", 400);
    assertPermission(principal(), module as AccessModule, "EXPORT");
    return reference.year;
  };

  switch (documentType as DocumentType) {
    case "DEVIATION_ANNEX_III": {
      const { id, code } = await record("DEVIATION");
      const detail = required(await getDeviationDetail(id));
      return word(await generateAnnexIII({ ...detail, anexoIIITemplateVersion: version, recordVersionLabel: versionLabel(latestSequence(detail)) } as Parameters<typeof generateAnnexIII>[0]), code);
    }
    case "DEVIATION_ANNEX_V": { const y = year(); return excel(await generateAnnexV(y, await getDeviationExportRows({ year: [String(y)] }), versionCode), String(y)); }
    case "CAPA_ANNEX_III": {
      const { id, code } = await record("CAPA");
      const detail = required(await getCapaDetail(id));
      return word(await generateCapaAnnexIII({ ...detail, annexIIITemplateVersion: version, recordVersionSequenceNumber: latestSequence(detail), recordVersionReason: null, versionFollowupDate: detail.openedAt } as unknown as Parameters<typeof generateCapaAnnexIII>[0]), code);
    }
    case "CAPA_ANNEX_IV": { const y = year(); return excel(await generateCapaAnnexIV(y, await getCapaExportRows({ year: [String(y)] }), versionCode), String(y)); }
    case "CHANGE_ANNEX_III":
    case "CHANGE_ANNEX_IV":
    case "CHANGE_ANNEX_V": {
      const followups = documentType === "CHANGE_ANNEX_V";
      const { id, code } = await record("CHANGE_CONTROL", followups ? { followups: { some: {} } } : undefined, followups ? "El Anexo V se prueba con un control de cambio que tenga algún seguimiento, y no hay ninguno (o el indicado no tiene)." : undefined);
      const detail = required(await getChangeControlDetail(id));
      if (documentType === "CHANGE_ANNEX_III") return word(await generateChangeAnnexIII({ ...detail, annexIIITemplateVersion: version } as Parameters<typeof generateChangeAnnexIII>[0]), code);
      if (documentType === "CHANGE_ANNEX_IV") return word(await generateChangeAnnexIV({ ...detail, annexIVTemplateVersion: version } as Parameters<typeof generateChangeAnnexIV>[0]), code);
      const sequence = required(detail.followups.at(-1), "El control de cambio no tiene seguimientos.").sequenceNumber;
      return word(await generateChangeAnnexV({ ...detail, annexVTemplateVersion: version } as Parameters<typeof generateChangeAnnexV>[0], sequence), code);
    }
    case "CHANGE_ANNEX_VII": { const y = year(); return excel(await generateChangeAnnexVII(y, await getChangeControlExportRows({ year: [String(y)] }), versionCode), String(y)); }
    case "COMPLAINT_ANNEX_III":
    case "COMPLAINT_ANNEX_IV": {
      const { id, code } = await record("COMPLAINT");
      const detail = required(await getComplaintDetail(id));
      return documentType === "COMPLAINT_ANNEX_III"
        ? word(await generateComplaintAnnexIII({ ...detail, annexIIITemplateVersion: version } as Parameters<typeof generateComplaintAnnexIII>[0]), code)
        : word(await generateComplaintAnnexIV({ ...detail, annexIVTemplateVersion: version } as Parameters<typeof generateComplaintAnnexIV>[0]), code);
    }
    case "COMPLAINT_ANNEX_V": { const y = year(); return excel(await generateComplaintAnnexV(y, await getComplaintExportRows({ year: [String(y)] }), versionCode), String(y)); }
    case "RETURN_ANNEX_III":
    case "RETURN_ANNEX_IV":
    case "RETURN_ANNEX_V": {
      const products = documentType === "RETURN_ANNEX_IV";
      const { id, code } = await record("RETURN", products ? { products: { some: {} } } : undefined, products ? "El Anexo IV se prueba con una devolución que tenga algún producto, y no hay ninguna (o la indicada no tiene)." : undefined);
      const detail = required(await getReturnDetail(id));
      if (documentType === "RETURN_ANNEX_III") return word(await generateReturnAnnexIII({ ...detail, annexIIITemplateVersion: version } as Parameters<typeof generateReturnAnnexIII>[0]), code);
      if (documentType === "RETURN_ANNEX_V") return word(await generateReturnAnnexV({ ...detail, annexVTemplateVersion: version } as Parameters<typeof generateReturnAnnexV>[0]), code);
      const product = required(detail.products[0], "La devolución no tiene productos.");
      return word(await generateReturnAnnexIV({ ...detail, annexIVTemplateVersion: version } as Parameters<typeof generateReturnAnnexIV>[0], product), code);
    }
    case "RETURN_ANNEX_VI": { const y = year(); return excel(await generateReturnAnnexVI(y, await getReturnExportRows({ year: [String(y)] }), versionCode), String(y)); }
    case "OOS_ANNEX_III":
    case "OOS_ANNEX_IV": {
      const fullScale = documentType === "OOS_ANNEX_IV";
      const { id, code } = await record("OOS", fullScale ? { phaseIDisposition: "FULL_SCALE" } : undefined, fullScale ? "El Anexo IV se prueba con un OOS cuya Fase I terminó en «Investigación a gran escala», y no hay ninguno (o el indicado no lo es)." : undefined);
      const detail = required(await getOosDetail(id));
      return word(fullScale ? fillOosAnnexIV(bytes, detail) : fillOosAnnexIII(bytes, detail), code);
    }
    case "OOS_ANNEX_VI": { const y = year(); return word(fillOosAnnexVI(bytes, y, await getOosAnnexVIRecords(y)), String(y)); }
    case "AUDIT_INTERNAL_REPORT":
    case "AUDIT_EXTERNAL_REPORT":
    case "AUDIT_CAPA_PLAN":
    case "AUDIT_EXTERNAL_PLAN": {
      const scenarios: Partial<Record<DocumentType, Prisma.AuditWhereInput>> = {
        AUDIT_INTERNAL_REPORT: { scenario: { in: ["INTERNAL_COVEX", "INTERNAL_CONTRACTED"] } },
        AUDIT_EXTERNAL_REPORT: { scenario: "SUPPLIER" },
        AUDIT_EXTERNAL_PLAN: { scenario: "SUPPLIER" },
        AUDIT_CAPA_PLAN: {},
      };
      const where = scenarios[documentType]!;
      const { id, code } = await record("AUDIT", Object.keys(where).length ? where as Record<string, unknown> : undefined, documentType === "AUDIT_CAPA_PLAN" ? undefined : `Este documento se prueba con una auditoría ${documentType === "AUDIT_INTERNAL_REPORT" ? "interna" : "de proveedor"} fuera de borrador, y no hay ninguna (o la indicada no lo es).`);
      const audit = required(await prisma.audit.findUnique({ where: { id }, include: auditReportInclude }));
      const sequence = (await prisma.qmsRecordVersion.findFirst({ where: { qmsRecordId: audit.qmsRecordId }, orderBy: { sequenceNumber: "desc" }, select: { sequenceNumber: true } }))?.sequenceNumber ?? 0;
      const snapshot = snapshotAudit(audit, []);
      try {
        if (documentType === "AUDIT_CAPA_PLAN") return excel(generateAuditCapaPlan(bytes, snapshot, null), code);
        if (documentType === "AUDIT_EXTERNAL_PLAN") return word(generateAuditExternalPlan(bytes, snapshot), code);
        return word(generateAuditReport(bytes, snapshot, sequence), code);
      } catch (error) {
        // Datos que le faltan a la auditoría elegida (por ejemplo, el programa del plan externo): se explican, no son un fallo de la plantilla.
        if (error instanceof Error && !(error instanceof TemplateTrialError)) throw new TemplateTrialError(`${error.message} Prueba con otra auditoría indicando su código.`);
        throw error;
      }
    }
    case "AUDIT_ANNUAL_INTERNAL_PROGRAMME":
    case "AUDIT_ANNUAL_EXTERNAL_PROGRAMME": {
      if (reference.kind !== "year") throw new TemplateTrialError("Este documento se prueba con un año.", 400);
      const auditType = documentType === "AUDIT_ANNUAL_INTERNAL_PROGRAMME" ? "INTERNAL" : "EXTERNAL";
      // Sin año indicado: el plan del año en curso o, si no hay, el más reciente.
      const plan = await prisma.auditAnnualPlan.findFirst({ where: { auditType, year: reference.year }, select: { id: true, year: true } })
        ?? (reference.explicit ? null : await prisma.auditAnnualPlan.findFirst({ where: { auditType }, orderBy: [{ year: "desc" }], select: { id: true, year: true } }));
      const label = auditType === "INTERNAL" ? "interno" : "externo";
      if (!plan) throw new TemplateTrialError(reference.explicit ? `No hay plan anual ${label} de ${reference.year}.` : `No hay ningún plan anual ${label} con el que probar la plantilla.`);
      assertPermission(principal(), "AUDIT", "DOWNLOAD", await resourceScope("AUDIT", plan.id, "AUDIT_PLAN"));
      const preview = await getProgrammePreview(plan.id);
      return word(generateAnnualProgramme(bytes, preview.content), String(plan.year));
    }
    default:
      throw new TemplateTrialError("Este documento no tiene una plantilla que se pueda probar con un expediente.", 400);
  }
}
