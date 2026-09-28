"use server";

import { InvestigationMethod, Prisma, QmsRecordType, QmsRelationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { persistenceFormError } from "@/lib/forms/persistence-error";
import { parseDeviationForm } from "@/modules/deviations/validation";
import type { FormState } from "@/modules/deviations/types";
import type { FollowupActionState } from "@/components/basic-followup-form";
import {
  getApplicableFormVersion,
  getApplicableTemplateVersion,
} from "@/modules/configuration/runtime";
import {
  ensureInitialVersion,
  refreshCurrentVersion,
  serializeDeviationVersion,
  snapshotJson,
  startNextVersion,
} from "@/lib/qms/versioning";

function toDate(value: string | null) {
  return value ? new Date(value) : null;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return { value: value === undefined ? null : value } as Prisma.InputJsonValue;
}

function scalarSnapshot(value: ReturnType<typeof parseDeviationForm>["values"]) {
  const { immediateActions, capaPlans, businessCode, departmentId, ...rest } = value;
  return { businessCode, departmentId, ...rest, immediateActions, capaPlans };
}

export async function createDeviationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseDeviationForm(formData);
  if (parsed.errors.length) {
    return { error: "No se puede guardar el expediente.", fieldErrors: parsed.errors };
  }

  const v = parsed.values;
  let deviationId: string;
  try {
    const department = await prisma.department.findUnique({ where: { id: v.departmentId! } });
    if (!department) return { error: "El departamento seleccionado no existe." };

    const referenceDate = toDate(v.issueDate) ?? new Date();
    const [formVersion, templateVersion] = await Promise.all([
      getApplicableFormVersion(QmsRecordType.DEVIATION, referenceDate),
      getApplicableTemplateVersion(
        QmsRecordType.DEVIATION,
        "DEVIATION_ANNEX_III",
        referenceDate,
      ),
    ]);

    const deviation = await prisma.$transaction(async (tx) => {
      const qmsRecord = await tx.qmsRecord.create({
        data: {
          recordType: QmsRecordType.DEVIATION,
          businessCode: v.businessCode,
          year: v.issueDate ? new Date(v.issueDate).getFullYear() : null,
        },
      });

      const created = await tx.deviation.create({
        data: {
          qmsRecordId: qmsRecord.id,
          departmentId: department.id,
          departmentCodeSnapshot: department.code,
          departmentNameSnapshot: department.name,
          issueDate: toDate(v.issueDate),
          eventDateTime: toDate(v.eventDateTime),
          detectedBy: v.detectedBy,
          createdByText: v.createdByText,
          materialProcessAffected: v.materialProcessAffected,
          provenance: v.provenance,
          formVersionId: formVersion?.id,
          anexoIIITemplateVersionId: templateVersion?.id,
          affectedDocumentation: v.affectedDocumentation,
          processEquipmentSystem: v.processEquipmentSystem,
          finishedProductSystem: v.finishedProductSystem,
          productLot: v.productLot,
          lotSize: v.lotSize,
          affectedQuantity: v.affectedQuantity,
          client: v.client,
          rawOrPackagingMaterial: v.rawOrPackagingMaterial,
          materialLot: v.materialLot,
          materialLotSize: v.materialLotSize,
          materialAffectedQuantity: v.materialAffectedQuantity,
          supplier: v.supplier,
          supplierLot: v.supplierLot,
          affectedEquipmentLine: v.affectedEquipmentLine,
          otherOrigin: v.otherOrigin,
          whatHappened: v.whatHappened,
          whoInvolved: v.whoInvolved,
          whenHappened: v.whenHappened,
          whereHappened: v.whereHappened,
          howHappened: v.howHappened,
          investigation: v.investigation,
          investigationConclusive: v.investigationConclusive,
          investigationMethods: v.investigationMethods as InvestigationMethod[],
          rootCause: v.rootCause,
          recurrentRootCause: v.recurrentRootCause,
          recurrenceDetails: v.recurrenceDetails,
          classification: v.classification,
          validationImpact: v.validationImpact,
          registrationImpact: v.registrationImpact,
          stabilityImpact: v.stabilityImpact,
          otherProcessesImpact: v.otherProcessesImpact,
          otherProcessesImpactDetails: v.otherProcessesImpactDetails,
          affectsFinishedProduct: v.affectsFinishedProduct,
          capaRequired: v.capaRequired,
          conclusion: v.conclusion,
          disposition: v.disposition,
          dispositionQuantity: v.dispositionQuantity,
          dispositionComments: v.dispositionComments,
          clientNotification: v.clientNotification,
          closedAt: toDate(v.closedAt),
          status: v.status,
          internalObservations: v.internalObservations,
          signedDocumentAvailable: v.signedDocumentAvailable,
          dataQualityStatus: v.dataQualityStatus,
          immediateActions: {
            create: v.immediateActions.map((action, index) => ({
              description: action.description,
              executedBy: action.executedBy || null,
              executedAt: toDate(action.executedAt),
              sortOrder: index,
            })),
          },
          capaPlans: {
            create: v.capaPlans.map((plan) => ({
              actionType: plan.actionType,
              description: plan.description,
              plannedExecutionDate: toDate(plan.plannedExecutionDate),
              responsible: plan.responsible || null,
            })),
          },
        },
      });

      await tx.changeHistory.create({
        data: {
          qmsRecordId: qmsRecord.id,
          changedByText: parsed.actor,
          fieldPath: "__created__",
          newValue: jsonValue(scalarSnapshot(v)),
          source: "UI",
        },
      });

      const versionRecord = await tx.deviation.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          qmsRecord: true,
          immediateActions: { orderBy: { sortOrder: "asc" } },
          followups: { orderBy: [{ followupDate: "asc" }, { createdAt: "asc" }] },
          capaPlans: {
            orderBy: { createdAt: "asc" },
            include: { linkedCapaRecord: true },
          },
          formVersion: true,
          anexoIIITemplateVersion: true,
        },
      });
      await ensureInitialVersion(
        tx,
        qmsRecord.id,
        snapshotJson(serializeDeviationVersion(versionRecord)),
        parsed.actor,
        "UI",
        "Emisión inicial de la desviación",
      );

      return created;
    });
    deviationId = deviation.id;
  } catch (error) {
    return persistenceFormError(error, "la desviación");
  }

  revalidatePath("/deviations");
  redirect(`/deviations/${deviationId}`);
}

export async function updateDeviationAction(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseDeviationForm(formData);
  if (parsed.errors.length) {
    return { error: "No se puede guardar el expediente.", fieldErrors: parsed.errors };
  }

  const existing = await prisma.deviation.findUnique({
    where: { id },
    include: {
      qmsRecord: true,
      immediateActions: { orderBy: { sortOrder: "asc" } },
      capaPlans: {
        orderBy: { createdAt: "asc" },
        include: { linkedCapaRecord: true },
      },
      followups: { orderBy: [{ followupDate: "asc" }, { createdAt: "asc" }] },
      formVersion: true,
      anexoIIITemplateVersion: true,
    },
  });
  if (!existing) return { error: "La desviación ya no existe." };

  const v = parsed.values;
  const reopening = existing.status === "CLOSED" && v.status === "OPEN";
  if (reopening) {
    v.closedAt = null;
  }
  const department = await prisma.department.findUnique({ where: { id: v.departmentId! } });
  if (!department) return { error: "El departamento seleccionado no existe." };

  const oldSnapshot = {
    businessCode: existing.qmsRecord.businessCode,
    departmentId: existing.departmentId,
    issueDate: existing.issueDate?.toISOString().slice(0, 10) ?? null,
    eventDateTime: existing.eventDateTime?.toISOString().slice(0, 16) ?? null,
    detectedBy: existing.detectedBy,
    createdByText: existing.createdByText,
    materialProcessAffected: existing.materialProcessAffected,
    provenance: existing.provenance,
    affectedDocumentation: existing.affectedDocumentation,
    processEquipmentSystem: existing.processEquipmentSystem,
    finishedProductSystem: existing.finishedProductSystem,
    productLot: existing.productLot,
    lotSize: existing.lotSize,
    affectedQuantity: existing.affectedQuantity,
    client: existing.client,
    rawOrPackagingMaterial: existing.rawOrPackagingMaterial,
    materialLot: existing.materialLot,
    materialLotSize: existing.materialLotSize,
    materialAffectedQuantity: existing.materialAffectedQuantity,
    supplier: existing.supplier,
    supplierLot: existing.supplierLot,
    affectedEquipmentLine: existing.affectedEquipmentLine,
    otherOrigin: existing.otherOrigin,
    whatHappened: existing.whatHappened,
    whoInvolved: existing.whoInvolved,
    whenHappened: existing.whenHappened,
    whereHappened: existing.whereHappened,
    howHappened: existing.howHappened,
    investigation: existing.investigation,
    investigationConclusive: existing.investigationConclusive,
    investigationMethods: existing.investigationMethods,
    rootCause: existing.rootCause,
    recurrentRootCause: existing.recurrentRootCause,
    recurrenceDetails: existing.recurrenceDetails,
    classification: existing.classification,
    validationImpact: existing.validationImpact,
    registrationImpact: existing.registrationImpact,
    stabilityImpact: existing.stabilityImpact,
    otherProcessesImpact: existing.otherProcessesImpact,
    otherProcessesImpactDetails: existing.otherProcessesImpactDetails,
    affectsFinishedProduct: existing.affectsFinishedProduct,
    capaRequired: existing.capaRequired,
    conclusion: existing.conclusion,
    disposition: existing.disposition,
    dispositionQuantity: existing.dispositionQuantity,
    dispositionComments: existing.dispositionComments,
    clientNotification: existing.clientNotification,
    closedAt: existing.closedAt?.toISOString().slice(0, 10) ?? null,
    status: existing.status,
    internalObservations: existing.internalObservations,
    signedDocumentAvailable: existing.signedDocumentAvailable,
    dataQualityStatus: existing.dataQualityStatus,
    immediateActions: existing.immediateActions.map((item) => ({
      description: item.description,
      executedBy: item.executedBy ?? "",
      executedAt: item.executedAt?.toISOString().slice(0, 10) ?? "",
    })),
    capaPlans: existing.capaPlans.map((item) => ({
      actionType: item.actionType,
      description: item.description,
      plannedExecutionDate: item.plannedExecutionDate?.toISOString().slice(0, 10) ?? "",
      responsible: item.responsible ?? "",
    })),
  };

  const newSnapshot = scalarSnapshot(v);
  const changed = Object.entries(newSnapshot).filter(([key, newValue]) => {
    const oldValue = (oldSnapshot as Record<string, unknown>)[key];
    const normal = (value: unknown) =>
      value instanceof Date ? value.toISOString() : JSON.stringify(value ?? null);
    return normal(oldValue) !== normal(newValue);
  });

  try {
    await prisma.$transaction(async (tx) => {
      const storedVersion = await tx.qmsRecordVersion.findFirst({
        where: { qmsRecordId: existing.qmsRecordId },
        orderBy: { sequenceNumber: "desc" },
      });
      if (!storedVersion) {
        await tx.qmsRecordVersion.create({
          data: {
            qmsRecordId: existing.qmsRecordId,
            sequenceNumber: 0,
            kind: "HISTORICAL_STATE",
            snapshot: snapshotJson(serializeDeviationVersion(existing)),
            reason: "Baseline histórico al activar Hito 6.1; no reconstruye revisiones anteriores no almacenadas",
            createdByText: parsed.actor,
            source: "SYSTEM",
          },
        });
      }
      await refreshCurrentVersion(
        tx,
        existing.qmsRecordId,
        snapshotJson(serializeDeviationVersion(existing)),
        parsed.actor,
        reopening ? "Estado anterior a la reapertura" : undefined,
      );

      await tx.qmsRecord.update({
        where: { id: existing.qmsRecordId },
        data: {
          businessCode: v.businessCode,
          year: v.issueDate ? new Date(v.issueDate).getFullYear() : null,
        },
      });

      await tx.deviation.update({
        where: { id },
        data: {
          departmentId: department.id,
          departmentCodeSnapshot:
            existing.departmentId === department.id
              ? existing.departmentCodeSnapshot ?? department.code
              : department.code,
          departmentNameSnapshot:
            existing.departmentId === department.id
              ? existing.departmentNameSnapshot ?? department.name
              : department.name,
          issueDate: toDate(v.issueDate),
          eventDateTime: toDate(v.eventDateTime),
          detectedBy: v.detectedBy,
          createdByText: v.createdByText,
          materialProcessAffected: v.materialProcessAffected,
          provenance: v.provenance,
          affectedDocumentation: v.affectedDocumentation,
          processEquipmentSystem: v.processEquipmentSystem,
          finishedProductSystem: v.finishedProductSystem,
          productLot: v.productLot,
          lotSize: v.lotSize,
          affectedQuantity: v.affectedQuantity,
          client: v.client,
          rawOrPackagingMaterial: v.rawOrPackagingMaterial,
          materialLot: v.materialLot,
          materialLotSize: v.materialLotSize,
          materialAffectedQuantity: v.materialAffectedQuantity,
          supplier: v.supplier,
          supplierLot: v.supplierLot,
          affectedEquipmentLine: v.affectedEquipmentLine,
          otherOrigin: v.otherOrigin,
          whatHappened: v.whatHappened,
          whoInvolved: v.whoInvolved,
          whenHappened: v.whenHappened,
          whereHappened: v.whereHappened,
          howHappened: v.howHappened,
          investigation: v.investigation,
          investigationConclusive: v.investigationConclusive,
          investigationMethods: v.investigationMethods as InvestigationMethod[],
          rootCause: v.rootCause,
          recurrentRootCause: v.recurrentRootCause,
          recurrenceDetails: v.recurrenceDetails,
          classification: v.classification,
          validationImpact: v.validationImpact,
          registrationImpact: v.registrationImpact,
          stabilityImpact: v.stabilityImpact,
          otherProcessesImpact: v.otherProcessesImpact,
          otherProcessesImpactDetails: v.otherProcessesImpactDetails,
          affectsFinishedProduct: v.affectsFinishedProduct,
          capaRequired: v.capaRequired,
          conclusion: v.conclusion,
          disposition: v.disposition,
          dispositionQuantity: v.dispositionQuantity,
          dispositionComments: v.dispositionComments,
          clientNotification: v.clientNotification,
          closedAt: toDate(v.closedAt),
          status: v.status,
          internalObservations: v.internalObservations,
          signedDocumentAvailable: v.signedDocumentAvailable,
          dataQualityStatus: v.dataQualityStatus,
        },
      });

      await tx.deviationImmediateAction.deleteMany({ where: { deviationId: id } });
      if (v.immediateActions.length) {
        await tx.deviationImmediateAction.createMany({
          data: v.immediateActions.map((action, index) => ({
            deviationId: id,
            description: action.description,
            executedBy: action.executedBy || null,
            executedAt: toDate(action.executedAt),
            sortOrder: index,
          })),
        });
      }

      await tx.deviationCapaPlan.deleteMany({
        where: { deviationId: id, proposalStatus: "PROPOSED" },
      });
      if (v.capaPlans.length) {
        await tx.deviationCapaPlan.createMany({
          data: v.capaPlans.map((plan) => ({
            deviationId: id,
            actionType: plan.actionType,
            description: plan.description,
            plannedExecutionDate: toDate(plan.plannedExecutionDate),
            responsible: plan.responsible || null,
            proposalStatus: "PROPOSED",
          })),
        });
      }

      if (changed.length) {
        await tx.changeHistory.createMany({
          data: changed.map(([key, newValue]) => ({
            qmsRecordId: existing.qmsRecordId,
            changedByText: parsed.actor,
            fieldPath: key,
            oldValue: jsonValue((oldSnapshot as Record<string, unknown>)[key]),
            newValue: jsonValue(newValue),
            reason: formData.get("changeReason")?.toString().trim() || null,
            source: "UI",
          })),
        });
      }

      const updatedForVersion = await tx.deviation.findUniqueOrThrow({
        where: { id },
        include: {
          qmsRecord: true,
          immediateActions: { orderBy: { sortOrder: "asc" } },
          followups: { orderBy: [{ followupDate: "asc" }, { createdAt: "asc" }] },
          capaPlans: {
            orderBy: { createdAt: "asc" },
            include: { linkedCapaRecord: true },
          },
          formVersion: true,
          anexoIIITemplateVersion: true,
        },
      });
      const versionSnapshot = snapshotJson(serializeDeviationVersion(updatedForVersion));
      if (reopening) {
        await startNextVersion(
          tx,
          existing.qmsRecordId,
          "REOPENING",
          versionSnapshot,
          parsed.actor,
          formData.get("changeReason")?.toString().trim() || "Reapertura de la desviación",
        );
        await tx.changeHistory.create({
          data: {
            qmsRecordId: existing.qmsRecordId,
            changedByText: parsed.actor,
            fieldPath: "__version__",
            newValue: jsonValue({ kind: "REOPENING" }),
            reason: formData.get("changeReason")?.toString().trim() || "Reapertura de la desviación",
            source: "UI",
          },
        });
      } else {
        await refreshCurrentVersion(
          tx,
          existing.qmsRecordId,
          versionSnapshot,
          parsed.actor,
          formData.get("changeReason")?.toString().trim() || null,
        );
      }
    });

    revalidatePath("/deviations");
    revalidatePath(`/deviations/${id}`);
    redirect(`/deviations/${id}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { error: "Ya existe una desviación con esa codificación." };
    }
    throw error;
  }
}

export async function addDeviationFollowupAction(deviationId: string, _state: FollowupActionState, formData: FormData): Promise<FollowupActionState> {
  const followupDate = formData.get("followupDate")?.toString();
  const completedByText = formData.get("completedByText")?.toString().trim();
  const comment = formData.get("comment")?.toString().trim();

  if (!followupDate || !completedByText || !comment) {
    return { error: "Fecha, cumplimentado por y seguimiento son obligatorios." };
  }

  const deviation = await prisma.deviation.findUnique({
    where: { id: deviationId },
    select: { qmsRecordId: true },
  });
  if (!deviation) return { error: "La desviación no existe." };

  const followupType = formData.get("followupType")?.toString().trim() || null;
  const nextFollowupDate = formData.get("nextFollowupDate")?.toString() || null;
  const evidenceReference = formData.get("evidenceReference")?.toString().trim() || null;

  try {
    await prisma.$transaction(async (tx) => {
      const followup = await tx.deviationFollowup.create({
        data: {
          deviationId,
          followupDate: new Date(followupDate),
          completedByText,
          followupType,
          comment,
          nextFollowupDate: nextFollowupDate ? new Date(nextFollowupDate) : null,
          evidenceReference,
        },
      });

      await tx.changeHistory.create({
        data: {
          qmsRecordId: deviation.qmsRecordId,
          changedByText: completedByText,
          fieldPath: "followups",
          newValue: jsonValue({
            id: followup.id,
            date: followupDate,
            type: followupType,
            comment,
            nextFollowupDate,
            evidenceReference,
          }),
          source: "UI",
        },
      });

      const updatedForVersion = await tx.deviation.findUniqueOrThrow({
        where: { id: deviationId },
        include: {
          qmsRecord: true,
          immediateActions: { orderBy: { sortOrder: "asc" } },
          followups: { orderBy: [{ followupDate: "asc" }, { createdAt: "asc" }] },
          capaPlans: {
            orderBy: { createdAt: "asc" },
            include: { linkedCapaRecord: true },
          },
          formVersion: true,
          anexoIIITemplateVersion: true,
        },
      });
      await refreshCurrentVersion(
        tx,
        deviation.qmsRecordId,
        snapshotJson(serializeDeviationVersion(updatedForVersion)),
        completedByText,
        "Actualización del estado vigente con nuevo seguimiento",
      );
    });
  } catch (error) {
    return persistenceFormError(error, "el seguimiento de la desviación");
  }

  revalidatePath(`/deviations/${deviationId}`);
  return { success: "Seguimiento guardado correctamente." };
}


export async function addDeviationRelationAction(id: string, formData: FormData) {
  const deviation = await prisma.deviation.findUnique({ where: { id }, select: { qmsRecordId: true } });
  if (!deviation) throw new Error("Desviación no encontrada.");

  const code = String(formData.get("businessCode") ?? "").trim();
  const rawType = String(formData.get("relationType") ?? "RELATED_TO");
  const actor = String(formData.get("actor") ?? process.env.DEFAULT_ACTOR_NAME ?? "Usuario demo").trim();
  if (!code) throw new Error("Debe indicarse la codificación del expediente relacionado.");

  const target = await prisma.qmsRecord.findFirst({
    where: { businessCode: code, id: { not: deviation.qmsRecordId } },
  });
  if (!target) throw new Error("No existe un expediente QMS con esa codificación.");

  const allowed = new Set(Object.values(QmsRelationType));
  if (!allowed.has(rawType as QmsRelationType)) throw new Error("Tipo de relación no válido.");
  const relationType = rawType as QmsRelationType;

  await prisma.qmsRelation.upsert({
    where: {
      sourceRecordId_targetRecordId_relationType: {
        sourceRecordId: deviation.qmsRecordId,
        targetRecordId: target.id,
        relationType,
      },
    },
    update: { isActive: true, createdByText: actor },
    create: {
      sourceRecordId: deviation.qmsRecordId,
      targetRecordId: target.id,
      relationType,
      createdByText: actor,
    },
  });

  revalidatePath("/deviations");
  revalidatePath(`/deviations/${id}`);
}
