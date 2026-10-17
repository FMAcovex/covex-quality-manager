"use server";

import { Prisma, QmsRecordType } from "@prisma/client";
import { authorizedAction } from "@/lib/auth/action-guard";
import { prisma } from "@/lib/db";
import { persistenceFormError } from "@/lib/forms/persistence-error";
import { preserveFormState } from "@/lib/forms/preserved-state";
import { assignOperationalBusinessCode, OperationalBusinessCodeError } from "@/lib/qms/business-code";
import { keepsOperationalStatus } from "@/modules/lifecycle";
import { parseOosForm, type OosFormValues } from "./validation";
import type { OosFormState } from "./types";

const date = (value: string | null) => (value ? new Date(value) : null);
const json = (value: unknown) => ({ value: value ?? null }) as Prisma.InputJsonValue;

type Department = { id: string; code: string; name: string };
type ExistingSnapshot = { departmentId: string | null; departmentCodeSnapshot: string | null; departmentNameSnapshot: string | null };

function recordData(values: OosFormValues, department: Department | null, existing?: ExistingSnapshot) {
  const keepSnapshot = existing?.departmentId === department?.id;
  return {
    departmentId: department?.id ?? null,
    departmentCodeSnapshot: department ? (keepSnapshot ? existing?.departmentCodeSnapshot ?? department.code : department.code) : null,
    departmentNameSnapshot: department ? (keepSnapshot ? existing?.departmentNameSnapshot ?? department.name : department.name) : null,
    status: values.status,
    area: values.area,
    createdByText: values.createdByText,
    issueDate: date(values.issueDate),
    materialKind: values.materialKind,
    materialName: values.materialName,
    lotNumber: values.lotNumber,
    batchSize: values.batchSize,
    affectedQuantity: values.affectedQuantity,
    supplier: values.materialKind === "RAW_OR_PACKAGING_MATERIAL" ? values.supplier : null,
    supplierLot: values.materialKind === "RAW_OR_PACKAGING_MATERIAL" ? values.supplierLot : null,
    process: values.process,
    oosDate: date(values.oosDate),
    oosTime: values.oosTime,
    detectedBy: values.detectedBy,
    shift: values.shift,
    detectionDescription: values.detectionDescription,
    phaseIEvaluation: values.phaseIEvaluation as Prisma.InputJsonObject,
    phaseIInvestigation: values.phaseIInvestigation,
    phaseIConclusion: values.phaseIConclusion,
    phaseIDisposition: values.phaseIDisposition,
    phaseIVerdict: values.phaseIVerdict,
    phaseIVerdictQuantity: values.phaseIVerdictQuantity,
    phaseIDestroyQuantity: values.phaseIDestroyQuantity,
    phaseIReturnQuantity: values.phaseIReturnQuantity,
    phaseIVerdictOther: values.phaseIVerdictOther,
    phaseIIssuedBy: values.phaseIIssuedBy,
    phaseIIssuedAt: date(values.phaseIIssuedAt),
    phaseIApprovedBy: values.phaseIApprovedBy,
    phaseIApprovedAt: date(values.phaseIApprovedAt),
    phaseIIIssueDate: date(values.phaseIIIssueDate),
    phaseIIProductionReview: values.phaseIIProductionReview,
    phaseIIRetesting: values.phaseIIRetesting,
    phaseIIResampling: values.phaseIIResampling,
    phaseIIConclusion: values.phaseIIConclusion,
    phaseIIVerdict: values.phaseIIVerdict,
    phaseIIVerdictQuantity: values.phaseIIVerdictQuantity,
    phaseIIDestroyQuantity: values.phaseIIDestroyQuantity,
    phaseIIReturnQuantity: values.phaseIIReturnQuantity,
    phaseIIVerdictOther: values.phaseIIVerdictOther,
    phaseIIIssuedBy: values.phaseIIIssuedBy,
    phaseIIIssuedAt: date(values.phaseIIIssuedAt),
    phaseIIAffectedDepartments: values.phaseIIAffectedDepartments,
    investigationResult: values.investigationResult,
    closedAt: date(values.closedAt),
    internalObservations: values.internalObservations,
  };
}

const lockRecord = (tx: Prisma.TransactionClient, qmsRecordId: string) =>
  tx.$queryRaw(Prisma.sql`SELECT id FROM "QmsRecord" WHERE id = ${qmsRecordId} FOR UPDATE`);

async function businessCodeFor(tx: Prisma.TransactionClient, values: OosFormValues, excludeQmsRecordId?: string) {
  const year = values.issueDate ? new Date(values.issueDate).getUTCFullYear() : null;
  if (!values.area || !year) {
    if (values.status !== "DRAFT") throw new OperationalBusinessCodeError("INVALID_FORMAT", "Para abrir el OOS deben estar informados el área y la fecha de emisión.");
    return { businessCode: null, year: null };
  }
  if (values.status === "DRAFT" && !values.businessCode) return { businessCode: null, year: null };
  const businessCode = await assignOperationalBusinessCode(tx, {
    recordType: QmsRecordType.OOS,
    year,
    oosArea: values.area,
    requestedCode: values.businessCode,
    excludeQmsRecordId,
  });
  return { businessCode, year };
}

async function createOosActionAuthenticatedContent(previous: OosFormState, fd: FormData): Promise<OosFormState> {
  const parsed = parseOosForm(fd);
  if (parsed.errors.length) return preserveFormState(previous, fd, { error: "No se puede guardar el OOS.", fieldErrors: parsed.errors });
  const values = parsed.values;
  let createdId: string;
  try {
    const department = values.departmentId ? await prisma.department.findUnique({ where: { id: values.departmentId } }) : null;
    if (values.departmentId && !department?.isActive) return preserveFormState(previous, fd, { error: "No se puede guardar el OOS.", fieldErrors: ["El departamento seleccionado no es válido."] });
    const created = await prisma.$transaction(async (tx) => {
      const { businessCode, year } = await businessCodeFor(tx, values);
      const qmsRecord = await tx.qmsRecord.create({ data: { recordType: QmsRecordType.OOS, businessCode, year } });
      const record = await tx.oosRecord.create({ data: { qmsRecordId: qmsRecord.id, ...recordData(values, department) } });
      await tx.changeHistory.create({ data: { qmsRecordId: qmsRecord.id, changedByText: parsed.actor, fieldPath: "__created__", newValue: json({ businessCode, materialName: values.materialName, lotNumber: values.lotNumber }), reason: values.status === "DRAFT" ? "Borrador inicial de OOS" : "Alta de OOS", source: "UI" } });
      return record;
    });
    createdId = created.id;
  } catch (error) {
    if (error instanceof OperationalBusinessCodeError) return preserveFormState(previous, fd, { error: "No se puede guardar el OOS.", fieldErrors: [error.message] });
    return preserveFormState(previous, fd, persistenceFormError(error, "el OOS"));
  }
  return { error: null, savedRecordId: createdId };
}

async function updateOosActionAuthenticatedContent(id: string, previous: OosFormState, fd: FormData): Promise<OosFormState> {
  const existing = await prisma.oosRecord.findUnique({ where: { id }, include: { qmsRecord: true } });
  if (!existing) return preserveFormState(previous, fd, { error: "El OOS ya no existe." });
  const parsed = parseOosForm(fd);
  if (parsed.errors.length) return preserveFormState(previous, fd, { error: "No se puede guardar el OOS.", fieldErrors: parsed.errors });
  const values = parsed.values;
  if (!keepsOperationalStatus(existing.status, values.status)) return preserveFormState(previous, fd, { error: "No se puede guardar el OOS.", fieldErrors: ["Un OOS abierto o cerrado no puede volver a Borrador."] });
  try {
    const department = values.departmentId ? await prisma.department.findUnique({ where: { id: values.departmentId } }) : null;
    if (values.departmentId && !department) return preserveFormState(previous, fd, { error: "No se puede guardar el OOS.", fieldErrors: ["El departamento seleccionado no es válido."] });
    await prisma.$transaction(async (tx) => {
      await lockRecord(tx, existing.qmsRecordId);
      const before = await tx.oosRecord.findUniqueOrThrow({ where: { id }, include: { qmsRecord: true } });
      if (!before.qmsRecord.isActive) throw new Error("No se puede modificar un OOS anulado.");
      if (!keepsOperationalStatus(before.status, values.status)) throw new Error("Un OOS abierto o cerrado no puede volver a Borrador.");
      let businessCode = before.qmsRecord.businessCode;
      let year = before.qmsRecord.year;
      if (businessCode) {
        // El código fija el área y el año: no se recalculan al editar.
        if (values.area !== before.area) throw new Error("El área debe conservar la codificación asignada.");
      } else {
        ({ businessCode, year } = await businessCodeFor(tx, values, before.qmsRecordId));
      }
      await tx.qmsRecord.update({ where: { id: before.qmsRecordId }, data: { businessCode, year } });
      const after = await tx.oosRecord.update({ where: { id }, data: recordData(values, department, before) });
      await tx.changeHistory.create({ data: { qmsRecordId: before.qmsRecordId, changedByText: parsed.actor, fieldPath: "__edit__", oldValue: json(historyView(before)), newValue: json(historyView(after)), reason: values.changeReason, source: "UI" } });
    });
  } catch (error) {
    if (error instanceof OperationalBusinessCodeError) return preserveFormState(previous, fd, { error: "No se puede guardar el OOS.", fieldErrors: [error.message] });
    return preserveFormState(previous, fd, persistenceFormError(error, "el OOS"));
  }
  return { error: null, savedRecordId: id };
}

/** Valores de negocio para el historial operativo: sin identificadores ni marcas técnicas. */
function historyView(record: Record<string, unknown>) {
  const omit = new Set(["id", "qmsRecordId", "qmsRecord", "departmentId", "extraData", "createdAt", "updatedAt"]);
  return Object.fromEntries(Object.entries(record).filter(([key]) => !omit.has(key)).map(([key, value]) => [key, value instanceof Date ? value.toISOString().slice(0, 10) : value]));
}

export async function createOosAction(...args: Parameters<typeof createOosActionAuthenticatedContent>) {
  return authorizedAction("createOosAction", args, (authenticated) => createOosActionAuthenticatedContent(...(authenticated as Parameters<typeof createOosActionAuthenticatedContent>)));
}

export async function updateOosAction(...args: Parameters<typeof updateOosActionAuthenticatedContent>) {
  return authorizedAction("updateOosAction", args, (authenticated) => updateOosActionAuthenticatedContent(...(authenticated as Parameters<typeof updateOosActionAuthenticatedContent>)));
}
