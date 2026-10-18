"use server";
import { authorizedAction } from "@/lib/auth/action-guard";
import { qmsDetailUrl } from "@/lib/qms/list-return-navigation";

import type { FollowupActionState } from "@/components/basic-followup-form";

import {
  ChangeTaskOrigin,
  Prisma,
  QmsRecordType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { responsibleUsersProblem } from "@/lib/auth/app-users";
import { optionalUserId } from "@/lib/qms/responsible-user";
import { persistenceFormError } from "@/lib/forms/persistence-error";
import { preserveFormState } from "@/lib/forms/preserved-state";
import {
  assignOperationalBusinessCode,
  OperationalBusinessCodeError,
} from "@/lib/qms/business-code";
import { parseChangeControlForm } from "@/modules/change-control/validation";
import type {
  ChangeControlFormState,
  ChangeFollowupTaskInput,
} from "@/modules/change-control/types";
import {
  getApplicableFormVersion,
  getApplicableTemplateVersion,
} from "@/modules/configuration/runtime";
import {
  refreshCurrentVersion,
  serializeChangeControlVersion,
  snapshotJson,
  startNextVersion,
} from "@/lib/qms/versioning";
import { acceptsFollowup, keepsOperationalStatus } from "@/modules/lifecycle";
import { followupFinalStatus } from "@/modules/change-control/lifecycle";

/** Usuarios responsables del formulario principal (D-101). */
function changeUserIds(v: ReturnType<typeof parseChangeControlForm>["values"]) {
  return [v.requestDecisionResponsibleUserId, v.followupResponsibleUserId, ...v.tasks.map((item) => item.responsibleUserId)];
}

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return { value: value === undefined ? null : value } as Prisma.InputJsonValue;
}

function scalarSnapshot(v: ReturnType<typeof parseChangeControlForm>["values"]) {
  return {
    businessCode: v.businessCode,
    departmentId: v.departmentId,
    requestDate: v.requestDate,
    requesterName: v.requesterName,
    requesterPosition: v.requesterPosition,
    scope: v.scope,
    otherScope: v.otherScope,
    description: v.description,
    justification: v.justification,
    providedDocuments: v.providedDocuments,
    requestDecision: v.requestDecision,
    requestDecisionResponsible: v.requestDecisionResponsible,
    requestDecisionResponsibleUserId: v.requestDecisionResponsibleUserId,
    requestDecisionRole: v.requestDecisionRole,
    requestDecisionDate: v.requestDecisionDate,
    evaluation: v.evaluation,
    classification: v.classification,
    plannedImplementationDate: v.plannedImplementationDate,
    committeeRequired: v.committeeRequired,
    committeeDetails: v.committeeDetails,
    clientNotificationRequired: v.clientNotificationRequired,
    clientNotificationDetails: v.clientNotificationDetails,
    authorityRequired: v.authorityRequired,
    authorityDetails: v.authorityDetails,
    pqrRequired: v.pqrRequired,
    pqrProducts: v.pqrProducts,
    pqrPeriod: v.pqrPeriod,
    stabilityRequired: v.stabilityRequired,
    stabilityAccelerated: v.stabilityAccelerated,
    stabilityOngoing: v.stabilityOngoing,
    additionalAnalysisRequired: v.additionalAnalysisRequired,
    additionalAnalysisDetails: v.additionalAnalysisDetails,
    additionalValidationRequired: v.additionalValidationRequired,
    additionalValidationDetails: v.additionalValidationDetails,
    otherImplicationRequired: v.otherImplicationRequired,
    otherImplicationDetails: v.otherImplicationDetails,
    dictamenResult: v.dictamenResult,
    dictamenDate: v.dictamenDate,
    followupResponsible: v.followupResponsible,
    followupResponsibleUserId: v.followupResponsibleUserId,
    dictamenObservations: v.dictamenObservations,
    internalObservations: v.internalObservations,
    signedDocumentAvailable: v.signedDocumentAvailable,
    dataQualityStatus: v.dataQualityStatus,
    finalStatus: v.finalStatus,
    tasks: v.tasks,
  };
}

async function taskCreateData(
  tx: Prisma.TransactionClient,
  tasks: ReturnType<typeof parseChangeControlForm>["values"]["tasks"],
  changeControlId: string,
  origin: ChangeTaskOrigin,
  introducedInFollowup: number | null,
) {
  const departments = await tx.department.findMany({
    where: { id: { in: tasks.map((item) => item.departmentId) } },
  });
  const byId = new Map(departments.map((item) => [item.id, item]));
  return tasks.map((item, index) => {
    const department = byId.get(item.departmentId);
    if (!department) {
      throw new Error(`No existe el departamento de la acción: ${item.departmentId}`);
    }
    return {
      changeControlId,
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      description: item.description,
      responsible: item.responsible || null,
      responsibleUserId: item.responsibleUserId ?? null,
      plannedDate: toDate(item.plannedDate),
      origin,
      introducedInFollowup,
      sortOrder: index,
    };
  });
}

async function createOpeningFollowup00(
  tx: Prisma.TransactionClient,
  changeControlId: string,
  qmsRecordId: string,
  dictamenDate: string,
  responsible: string,
  responsibleUserId: string | null,
  nextFollowupDate: string,
  actor: string,
) {
  const existing00 = await tx.changeControlFollowup.findUnique({
    where: { changeControlId_sequenceNumber: { changeControlId, sequenceNumber: 0 } },
  });
  if (existing00) return existing00;

  const tasks = await tx.changeControlTask.findMany({
    where: { changeControlId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const followup = await tx.changeControlFollowup.create({
    data: {
      changeControlId,
      sequenceNumber: 0,
      followupDate: new Date(dictamenDate),
      responsible,
      responsibleUserId,
      executionStatus: "NOT_EXECUTED",
      effectivenessStatus: "PENDING",
      closeChange: false,
      nextFollowupDate: new Date(nextFollowupDate),
    },
  });
  if (tasks.length) {
    await tx.changeControlTaskState.createMany({
      data: tasks.map((task) => ({
        followupId: followup.id,
        taskId: task.id,
        status: "PENDING" as const,
      })),
    });
  }
  await tx.changeHistory.create({
    data: {
      qmsRecordId,
      changedByText: actor,
      fieldPath: "followups[0]",
      newValue: jsonValue({
        followupDate: dictamenDate,
        responsible,
        nextFollowupDate,
        source: "DICTAMEN",
      }),
      reason: "Seguimiento 00 · apertura desde Dictamen aprobado",
      source: "UI",
    },
  });
  return followup;
}

async function createChangeControlActionAuthenticatedContent(
  previous: ChangeControlFormState,
  formData: FormData,
): Promise<ChangeControlFormState> {
  const parsed = parseChangeControlForm(formData);
  if (parsed.errors.length) {
    return preserveFormState(previous, formData, { error: "No se puede guardar el Control de Cambio.", fieldErrors: parsed.errors, fieldIssues: parsed.fieldIssues });
  }
  const v = parsed.values;
  const userProblem = await responsibleUsersProblem(changeUserIds(v));
  if (userProblem) return preserveFormState(previous, formData, { error: "No se puede guardar el Control de Cambio.", fieldErrors: [userProblem] });
  let createdId: string;
  try {
    const department = v.departmentId
      ? await prisma.department.findUnique({ where: { id: v.departmentId } })
      : null;
    if (v.finalStatus !== "DRAFT" && !department) {
      return preserveFormState(previous, formData, { error: "El departamento seleccionado no existe." });
    }

    const referenceDate = toDate(v.requestDate) ?? new Date();
    const [formVersion, annexIII, annexIV, annexV] = await Promise.all([
      getApplicableFormVersion(QmsRecordType.CHANGE_CONTROL, referenceDate),
      getApplicableTemplateVersion(QmsRecordType.CHANGE_CONTROL, "CHANGE_ANNEX_III", referenceDate),
      getApplicableTemplateVersion(QmsRecordType.CHANGE_CONTROL, "CHANGE_ANNEX_IV", referenceDate),
      getApplicableTemplateVersion(QmsRecordType.CHANGE_CONTROL, "CHANGE_ANNEX_V", referenceDate),
    ]);

    const created = await prisma.$transaction(async (tx) => {
      const requestYear = v.requestDate ? new Date(v.requestDate).getFullYear() : null;
      let businessCode = v.businessCode;
      if (department && requestYear && (v.finalStatus !== "DRAFT" || businessCode)) {
        businessCode = await assignOperationalBusinessCode(tx, {
          recordType: QmsRecordType.CHANGE_CONTROL,
          year: requestYear,
          departmentCode: department.code,
          requestedCode: businessCode,
        });
      } else if (v.finalStatus !== "DRAFT") {
        throw new OperationalBusinessCodeError(
          "INVALID_FORMAT",
          "Para abrir el Control de Cambio deben estar informados departamento y fecha de solicitud.",
        );
      } else {
        businessCode = null;
      }
      v.businessCode = businessCode;

      const qmsRecord = await tx.qmsRecord.create({
        data: {
          recordType: QmsRecordType.CHANGE_CONTROL,
          businessCode,
          year: requestYear,
        },
      });

      const change = await tx.changeControl.create({
        data: {
          qmsRecordId: qmsRecord.id,
          departmentId: department?.id ?? null,
          departmentCodeSnapshot: department?.code ?? null,
          departmentNameSnapshot: department?.name ?? null,
          requestDate: toDate(v.requestDate),
          requesterName: v.requesterName,
          requesterPosition: v.requesterPosition,
          scope: v.scope,
          otherScope: v.otherScope,
          description: v.description,
          justification: v.justification,
          providedDocuments: v.providedDocuments,
          requestDecision: v.requestDecision,
          requestDecisionResponsible: v.requestDecisionResponsible,
          requestDecisionResponsibleUserId: v.requestDecisionResponsibleUserId,
          requestDecisionRole: v.requestDecisionRole,
          requestDecisionDate: toDate(v.requestDecisionDate),
          evaluation: v.evaluation,
          classification: v.classification,
          plannedImplementationDate: toDate(v.plannedImplementationDate),
          committeeRequired: v.committeeRequired,
          committeeDetails: v.committeeDetails,
          clientNotificationRequired: v.clientNotificationRequired,
          clientNotificationDetails: v.clientNotificationDetails,
          authorityRequired: v.authorityRequired,
          authorityDetails: v.authorityDetails,
          pqrRequired: v.pqrRequired,
          pqrProducts: v.pqrProducts,
          pqrPeriod: v.pqrPeriod,
          stabilityRequired: v.stabilityRequired,
          stabilityAccelerated: v.stabilityAccelerated,
          stabilityOngoing: v.stabilityOngoing,
          additionalAnalysisRequired: v.additionalAnalysisRequired,
          additionalAnalysisDetails: v.additionalAnalysisDetails,
          additionalValidationRequired: v.additionalValidationRequired,
          additionalValidationDetails: v.additionalValidationDetails,
          otherImplicationRequired: v.otherImplicationRequired,
          otherImplicationDetails: v.otherImplicationDetails,
          dictamenResult: v.dictamenResult,
          dictamenDate: toDate(v.dictamenDate),
          followupResponsible: v.followupResponsible,
          followupResponsibleUserId: v.followupResponsibleUserId,
          dictamenObservations: v.dictamenObservations,
          internalObservations: v.internalObservations,
          signedDocumentAvailable: v.signedDocumentAvailable,
          dataQualityStatus: v.dataQualityStatus,
          finalStatus: v.finalStatus,
          formVersionId: formVersion?.id,
          annexIIITemplateVersionId: annexIII?.id,
          annexIVTemplateVersionId: annexIV?.id,
          annexVTemplateVersionId: annexV?.id,
        },
      });

      if (v.tasks.length) {
        const data = await taskCreateData(tx, v.tasks, change.id, "DICTAMEN", null);
        await tx.changeControlTask.createMany({ data });
      }

      if (
        v.finalStatus !== "DRAFT" &&
        v.dictamenResult === "APPROVED" &&
        v.dictamenDate &&
        v.followupResponsible &&
        v.nextFollowupDate
      ) {
        const followup00 = await createOpeningFollowup00(
          tx,
          change.id,
          qmsRecord.id,
          v.dictamenDate,
          v.followupResponsible,
          v.followupResponsibleUserId,
          v.nextFollowupDate,
          parsed.actor,
        );
        const versionRecord = await tx.changeControl.findUniqueOrThrow({
          where: { id: change.id },
          include: {
            qmsRecord: true,
            tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
            followups: {
              orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }],
              include: { taskStates: { orderBy: { createdAt: "asc" } } },
            },
            formVersion: true,
            annexIIITemplateVersion: true,
            annexIVTemplateVersion: true,
            annexVTemplateVersion: true,
          },
        });
        await startNextVersion(
          tx,
          qmsRecord.id,
          "FOLLOWUP",
          snapshotJson(serializeChangeControlVersion(versionRecord)),
          parsed.actor,
          "Seguimiento 00 · apertura desde Dictamen aprobado",
          followup00.id,
          "UI",
          0,
        );
      }

      await tx.changeHistory.create({
        data: {
          qmsRecordId: qmsRecord.id,
          changedByText: parsed.actor,
          fieldPath: "__created__",
          newValue: jsonValue(scalarSnapshot(v)),
          reason: v.finalStatus === "DRAFT" ? "Borrador inicial del Control de Cambio" : "Alta del Control de Cambio",
          source: "UI",
        },
      });

      return change;
    });
    createdId = created.id;
  } catch (error) {
    if (error instanceof OperationalBusinessCodeError) {
      return preserveFormState(previous, formData, {
        error: "No se puede guardar el Control de Cambio.",
        fieldErrors: [error.message],
      });
    }
    return preserveFormState(previous, formData, persistenceFormError(error, "el Control de Cambio"));
  }

  revalidatePath("/changes");
  redirect(`/changes/${createdId}`);
}

async function updateChangeControlActionAuthenticatedContent(
  id: string,
  previous: ChangeControlFormState,
  formData: FormData,
): Promise<ChangeControlFormState> {
  const parsed = parseChangeControlForm(formData);
  if (parsed.errors.length) {
    return preserveFormState(previous, formData, { error: "No se puede guardar el Control de Cambio.", fieldErrors: parsed.errors, fieldIssues: parsed.fieldIssues });
  }

  const existing = await prisma.changeControl.findUnique({
    where: { id },
    include: {
      qmsRecord: true,
      tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: {
        orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }],
        include: { taskStates: true },
      },
      formVersion: true,
      annexIIITemplateVersion: true,
      annexIVTemplateVersion: true,
      annexVTemplateVersion: true,
    },
  });
  if (!existing) return preserveFormState(previous, formData, { error: "El Control de Cambio ya no existe." });

  const v = parsed.values;
  const userProblem = await responsibleUsersProblem(changeUserIds(v), [
    existing.requestDecisionResponsibleUserId,
    existing.followupResponsibleUserId,
    ...existing.tasks.map((item) => item.responsibleUserId),
  ]);
  if (userProblem) return preserveFormState(previous, formData, { error: "No se puede guardar el Control de Cambio.", fieldErrors: [userProblem] });
  const requestedBusinessCode = v.businessCode;
  v.businessCode = existing.qmsRecord.businessCode ?? requestedBusinessCode;
  if (!keepsOperationalStatus(existing.finalStatus, v.finalStatus)) {
    return preserveFormState(previous, formData, {
      error: "No se puede volver a borrador un Control de Cambio ya operativo.",
      fieldErrors: ["Un Control de Cambio abierto o cerrado no puede volver al estado Borrador."],
    });
  }
  const department = v.departmentId
    ? await prisma.department.findUnique({ where: { id: v.departmentId } })
    : null;
  if (v.finalStatus !== "DRAFT" && !department) {
    return preserveFormState(previous, formData, { error: "El departamento seleccionado no existe." });
  }

  // El usuario vinculado no forma parte del plan aprobado: se puede asignar después (D-101).
  const approvedDictamenTasks = existing.tasks.filter((item) => item.origin === "DICTAMEN");
  if (existing.dictamenResult === "APPROVED") {
    const oldBaseline = approvedDictamenTasks
      .map((item) => ({
        departmentId: item.departmentId ?? "",
        description: item.description,
        responsible: item.responsible ?? "",
        plannedDate: item.plannedDate?.toISOString().slice(0, 10) ?? "",
      }));
    const incoming = v.tasks.map((item) => ({
      departmentId: item.departmentId,
      description: item.description,
      responsible: item.responsible,
      plannedDate: item.plannedDate,
    }));
    if (JSON.stringify(oldBaseline) !== JSON.stringify(incoming)) {
      return preserveFormState(previous, formData, {
        error: "El plan aprobado del Dictamen está bloqueado.",
        fieldErrors: [
          "No se pueden sustituir ni modificar silenciosamente las acciones del Dictamen aprobado. Añade las nuevas acciones desde un seguimiento.",
        ],
      });
    }
  }

  const oldSnapshot = {
    businessCode: existing.qmsRecord.businessCode,
    departmentId: existing.departmentId,
    requestDate: existing.requestDate?.toISOString().slice(0, 10) ?? null,
    requesterName: existing.requesterName,
    requesterPosition: existing.requesterPosition,
    scope: existing.scope,
    otherScope: existing.otherScope,
    description: existing.description,
    justification: existing.justification,
    providedDocuments: existing.providedDocuments,
    requestDecision: existing.requestDecision,
    requestDecisionResponsibleUserId: existing.requestDecisionResponsibleUserId,
    evaluation: existing.evaluation,
    classification: existing.classification,
    plannedImplementationDate: existing.plannedImplementationDate?.toISOString().slice(0, 10) ?? null,
    dictamenResult: existing.dictamenResult,
    dictamenDate: existing.dictamenDate?.toISOString().slice(0, 10) ?? null,
    followupResponsibleUserId: existing.followupResponsibleUserId,
  };

  try {
    await prisma.$transaction(async (tx) => {
      const requestYear = v.requestDate ? new Date(v.requestDate).getFullYear() : null;
      let businessCode = existing.qmsRecord.businessCode;
      if (existing.finalStatus === "DRAFT" && department && requestYear) {
        if (!businessCode && (v.finalStatus !== "DRAFT" || requestedBusinessCode)) {
          businessCode = await assignOperationalBusinessCode(tx, {
            recordType: QmsRecordType.CHANGE_CONTROL,
            year: requestYear,
            departmentCode: department.code,
            requestedCode: requestedBusinessCode,
            excludeQmsRecordId: existing.qmsRecordId,
          });
        } else if (businessCode && requestedBusinessCode && requestedBusinessCode !== businessCode) {
          businessCode = await assignOperationalBusinessCode(tx, {
            recordType: QmsRecordType.CHANGE_CONTROL,
            year: requestYear,
            departmentCode: department.code,
            requestedCode: requestedBusinessCode,
            excludeQmsRecordId: existing.qmsRecordId,
          });
        }
      }
      v.businessCode = businessCode;

      await tx.qmsRecord.update({
        where: { id: existing.qmsRecordId },
        data: {
          businessCode,
          year: requestYear,
        },
      });

      await tx.changeControl.update({
        where: { id },
        data: {
          departmentId: department?.id ?? null,
          departmentCodeSnapshot: department
            ? existing.departmentId === department.id
              ? existing.departmentCodeSnapshot ?? department.code
              : department.code
            : null,
          departmentNameSnapshot: department
            ? existing.departmentId === department.id
              ? existing.departmentNameSnapshot ?? department.name
              : department.name
            : null,
          requestDate: toDate(v.requestDate),
          requesterName: v.requesterName,
          requesterPosition: v.requesterPosition,
          scope: v.scope,
          otherScope: v.otherScope,
          description: v.description,
          justification: v.justification,
          providedDocuments: v.providedDocuments,
          requestDecision: v.requestDecision,
          requestDecisionResponsible: v.requestDecisionResponsible,
          requestDecisionResponsibleUserId: v.requestDecisionResponsibleUserId,
          requestDecisionRole: v.requestDecisionRole,
          requestDecisionDate: toDate(v.requestDecisionDate),
          evaluation: v.evaluation,
          classification: v.classification,
          plannedImplementationDate: toDate(v.plannedImplementationDate),
          committeeRequired: v.committeeRequired,
          committeeDetails: v.committeeDetails,
          clientNotificationRequired: v.clientNotificationRequired,
          clientNotificationDetails: v.clientNotificationDetails,
          authorityRequired: v.authorityRequired,
          authorityDetails: v.authorityDetails,
          pqrRequired: v.pqrRequired,
          pqrProducts: v.pqrProducts,
          pqrPeriod: v.pqrPeriod,
          stabilityRequired: v.stabilityRequired,
          stabilityAccelerated: v.stabilityAccelerated,
          stabilityOngoing: v.stabilityOngoing,
          additionalAnalysisRequired: v.additionalAnalysisRequired,
          additionalAnalysisDetails: v.additionalAnalysisDetails,
          additionalValidationRequired: v.additionalValidationRequired,
          additionalValidationDetails: v.additionalValidationDetails,
          otherImplicationRequired: v.otherImplicationRequired,
          otherImplicationDetails: v.otherImplicationDetails,
          dictamenResult: v.dictamenResult,
          dictamenDate: toDate(v.dictamenDate),
          followupResponsible: v.followupResponsible,
          followupResponsibleUserId: v.followupResponsibleUserId,
          dictamenObservations: v.dictamenObservations,
          internalObservations: v.internalObservations,
          signedDocumentAvailable: v.signedDocumentAvailable,
          dataQualityStatus: v.dataQualityStatus,
          finalStatus: v.finalStatus,
        },
      });

      if (existing.dictamenResult === "APPROVED") {
        for (const [index, task] of approvedDictamenTasks.entries()) {
          const responsibleUserId = v.tasks[index]?.responsibleUserId ?? null;
          if (task.responsibleUserId !== responsibleUserId) {
            await tx.changeControlTask.update({ where: { id: task.id }, data: { responsibleUserId } });
          }
        }
      } else {
        await tx.changeControlTask.deleteMany({
          where: { changeControlId: id, origin: "DICTAMEN" },
        });
        if (v.tasks.length) {
          const data = await taskCreateData(tx, v.tasks, id, "DICTAMEN", null);
          await tx.changeControlTask.createMany({ data });
        }
      }

      const newSnapshot = scalarSnapshot(v);
      for (const [fieldPath, value] of Object.entries(newSnapshot)) {
        if (JSON.stringify((oldSnapshot as Record<string, unknown>)[fieldPath] ?? null) !== JSON.stringify(value ?? null)) {
          await tx.changeHistory.create({
            data: {
              qmsRecordId: existing.qmsRecordId,
              changedByText: parsed.actor,
              fieldPath,
              oldValue: jsonValue((oldSnapshot as Record<string, unknown>)[fieldPath]),
              newValue: jsonValue(value),
              reason: v.changeReason,
              source: "UI",
            },
          });
        }
      }

      if (
        existing.dictamenResult !== "APPROVED" &&
        v.dictamenResult === "APPROVED" &&
        existing.followups.length === 0 &&
        v.dictamenDate &&
        v.followupResponsible &&
        v.nextFollowupDate
      ) {
        const followup00 = await createOpeningFollowup00(
          tx,
          id,
          existing.qmsRecordId,
          v.dictamenDate,
          v.followupResponsible,
          v.followupResponsibleUserId,
          v.nextFollowupDate,
          parsed.actor,
        );
        const openingVersionRecord = await tx.changeControl.findUniqueOrThrow({
          where: { id },
          include: {
            qmsRecord: true,
            tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
            followups: {
              orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }],
              include: { taskStates: { orderBy: { createdAt: "asc" } } },
            },
            formVersion: true,
            annexIIITemplateVersion: true,
            annexIVTemplateVersion: true,
            annexVTemplateVersion: true,
          },
        });
        const stored00 = await tx.qmsRecordVersion.findUnique({
          where: {
            qmsRecordId_sequenceNumber: {
              qmsRecordId: existing.qmsRecordId,
              sequenceNumber: 0,
            },
          },
        });
        if (stored00) {
          await tx.qmsRecordVersion.update({
            where: { id: stored00.id },
            data: {
              kind: "FOLLOWUP",
              sourceEntityId: followup00.id,
              snapshot: snapshotJson(serializeChangeControlVersion(openingVersionRecord)),
              reason: "Seguimiento 00 · apertura desde Dictamen aprobado",
              createdByText: parsed.actor,
            },
          });
        } else {
          await startNextVersion(
            tx,
            existing.qmsRecordId,
            "FOLLOWUP",
            snapshotJson(serializeChangeControlVersion(openingVersionRecord)),
            parsed.actor,
            "Seguimiento 00 · apertura desde Dictamen aprobado",
            followup00.id,
            "UI",
            0,
          );
        }
      }

      const currentVersion = await tx.qmsRecordVersion.findFirst({
        where: { qmsRecordId: existing.qmsRecordId, frozenAt: null },
        orderBy: { sequenceNumber: "desc" },
      });
      if (currentVersion) {
        const refreshed = await tx.changeControl.findUniqueOrThrow({
          where: { id },
          include: {
            qmsRecord: true,
            tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
            followups: {
              orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }],
              include: { taskStates: { orderBy: { createdAt: "asc" } } },
            },
            formVersion: true,
            annexIIITemplateVersion: true,
            annexIVTemplateVersion: true,
            annexVTemplateVersion: true,
          },
        });
        await refreshCurrentVersion(
          tx,
          existing.qmsRecordId,
          snapshotJson(serializeChangeControlVersion(refreshed)),
          parsed.actor,
          v.changeReason,
        );
      }
    });

  } catch (error) {
    if (error instanceof OperationalBusinessCodeError) {
      return preserveFormState(previous, formData, {
        error: "No se puede guardar el Control de Cambio.",
        fieldErrors: [error.message],
      });
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return preserveFormState(previous, formData, { error: "Ya existe un Control de Cambio con esa codificación." });
    }
    return preserveFormState(previous, formData, persistenceFormError(error, "el Control de Cambio"));
  }
  revalidatePath("/changes");
  revalidatePath(`/changes/${id}`);
  redirect(qmsDetailUrl("/changes", id, formData.get("returnTo"), formData.get("detailTab")));
}

function parseFollowupTasks(raw: string): ChangeFollowupTaskInput[] {
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map<ChangeFollowupTaskInput>((item) => ({
        taskId: typeof item.taskId === "string" ? item.taskId : undefined,
        departmentId: typeof item.departmentId === "string" ? item.departmentId : "",
        description: typeof item.description === "string" ? item.description.trim() : "",
        responsible: typeof item.responsible === "string" ? item.responsible.trim() : "",
        responsibleUserId: optionalUserId(item.responsibleUserId) ?? null,
        plannedDate: typeof item.plannedDate === "string" ? item.plannedDate : "",
        status:
          item.status === "COMPLETED" || item.status === "NOT_APPLICABLE"
            ? item.status
            : "PENDING",
        actualDate: typeof item.actualDate === "string" ? item.actualDate : "",
        evidenceComment: typeof item.evidenceComment === "string" ? item.evidenceComment.trim() : "",
        isNew: item.isNew === true,
      }))
      .filter((item) => item.description && (item.departmentId || item.taskId));
  } catch {
    return [];
  }
}

async function addChangeControlFollowupActionAuthenticatedContent(id: string, _state: FollowupActionState, formData: FormData): Promise<FollowupActionState> {
  const change = await prisma.changeControl.findUnique({
    where: { id },
    include: {
      qmsRecord: true,
      tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: {
        orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }],
        include: { taskStates: { orderBy: { createdAt: "asc" } } },
      },
      formVersion: true,
      annexIIITemplateVersion: true,
      annexIVTemplateVersion: true,
      annexVTemplateVersion: true,
    },
  });
  if (!change) return { error: "Control de Cambio no encontrado." };
  if (!acceptsFollowup(change.finalStatus)) {
    return { error: "El Control de Cambio debe estar abierto antes de registrar seguimientos." };
  }
  if (change.dictamenResult !== "APPROVED") {
    return { error: "Solo se puede registrar seguimiento cuando el Dictamen está aprobado." };
  }

  const followupDate = String(formData.get("followupDate") ?? "").trim();
  const responsible = String(formData.get("responsible") ?? "").trim();
  const responsibleUserId = optionalUserId(formData.get("responsibleUserId")) ?? null;
  const observations = String(formData.get("observations") ?? "").trim();
  const executionStatus = String(formData.get("executionStatus") ?? "NOT_EXECUTED");
  const executionDate = String(formData.get("executionDate") ?? "").trim();
  const effectivenessStatus = String(formData.get("effectivenessStatus") ?? "PENDING");
  const effectivenessObservations = String(formData.get("effectivenessObservations") ?? "").trim();
  const closeChange = formData.get("closeChange") === "true";
  const nextFollowupDate = String(formData.get("nextFollowupDate") ?? "").trim();
  const remainOpenReason = String(formData.get("remainOpenReason") ?? "").trim();
  const conclusion = String(formData.get("conclusion") ?? "").trim();
  const approvalByText = String(formData.get("approvalByText") ?? "").trim();
  const tasks = parseFollowupTasks(String(formData.get("tasksJson") ?? "[]"));

  if (!followupDate || !responsible) return { error: "Fecha y responsable de seguimiento son obligatorios." };
  if (!["NOT_EXECUTED", "EXECUTED"].includes(executionStatus)) return { error: "Estado de ejecución no válido." };
  if (!["PENDING", "ACCEPTABLE", "NOT_ACCEPTABLE", "NOT_APPLICABLE"].includes(effectivenessStatus)) {
    return { error: "Estado de eficacia no válido." };
  }
  if (!tasks.length) return { error: "El seguimiento debe incluir el estado de las acciones." };
  const followupUserProblem = await responsibleUsersProblem([responsibleUserId, ...tasks.filter((item) => item.isNew).map((item) => item.responsibleUserId)]);
  if (followupUserProblem) return { error: followupUserProblem };

  const sequenceNumber = Math.max(-1, ...change.followups.map((item) => item.sequenceNumber)) + 1;
  const existingTaskIds = new Set(change.tasks.map((item) => item.id));
  const submittedExisting = tasks.filter((item) => item.taskId && existingTaskIds.has(item.taskId));
  if (submittedExisting.length !== change.tasks.length) {
    return { error: "El seguimiento debe conservar todas las acciones existentes." };
  }

  if (executionStatus === "EXECUTED") {
    if (!executionDate) return { error: "Un cambio Ejecutado requiere fecha de ejecución." };
    const pending = tasks.some((item) => item.status === "PENDING");
    if (pending) return { error: "No se puede marcar Ejecutado mientras existan acciones pendientes." };
  }
  if (closeChange) {
    if (executionStatus === "EXECUTED") {
      if (effectivenessStatus !== "ACCEPTABLE") {
        return { error: "El cierre efectivo de un cambio ejecutado requiere eficacia Aceptable." };
      }
    } else if (effectivenessStatus !== "NOT_APPLICABLE") {
      return { error: "Un cierre sin ejecución debe registrar la eficacia como No aplica." };
    }
    if (!conclusion) return { error: "El cierre requiere motivo/conclusión documentado." };
    if (!approvalByText) return { error: "Debe identificarse la aprobación del cierre." };
  } else if (!nextFollowupDate || !remainOpenReason) {
    return { error: "Si el cambio permanece abierto, debe indicarse motivo y próxima fecha de seguimiento." };
  }

  await prisma.$transaction(async (tx) => {
    const newTaskInputs = tasks.filter((item) => item.isNew);
    const newTaskMap = new Map<number, string>();
    if (newTaskInputs.length) {
      const data = await taskCreateData(
        tx,
        newTaskInputs.map((item) => ({
          departmentId: item.departmentId,
          description: item.description,
          responsible: item.responsible,
          responsibleUserId: item.responsibleUserId ?? null,
          plannedDate: item.plannedDate,
        })),
        id,
        "FOLLOWUP",
        sequenceNumber,
      );
      for (let i = 0; i < data.length; i += 1) {
        const created = await tx.changeControlTask.create({ data: data[i] });
        newTaskMap.set(i, created.id);
      }
    }

    const followup = await tx.changeControlFollowup.create({
      data: {
        changeControlId: id,
        sequenceNumber,
        followupDate: new Date(followupDate),
        responsible,
        responsibleUserId,
        observations: observations || null,
        executionStatus: executionStatus as "NOT_EXECUTED" | "EXECUTED",
        executionDate: toDate(executionDate),
        effectivenessStatus: effectivenessStatus as "PENDING" | "ACCEPTABLE" | "NOT_ACCEPTABLE" | "NOT_APPLICABLE",
        effectivenessObservations: effectivenessObservations || null,
        closeChange,
        nextFollowupDate: toDate(nextFollowupDate),
        remainOpenReason: remainOpenReason || null,
        conclusion: conclusion || null,
        approvalByText: approvalByText || null,
      },
    });

    let newIndex = 0;
    for (const item of tasks) {
      const taskId = item.isNew ? newTaskMap.get(newIndex++) : item.taskId;
      if (!taskId) throw new Error("No se pudo resolver una acción del seguimiento.");
      await tx.changeControlTaskState.create({
        data: {
          followupId: followup.id,
          taskId,
          status: item.status,
          actualDate: toDate(item.actualDate),
          evidenceComment: item.evidenceComment || null,
        },
      });
    }

    await tx.changeControl.update({
      where: { id },
      data: {
        executionStatus: executionStatus as "NOT_EXECUTED" | "EXECUTED",
        executionDate: toDate(executionDate),
        operationalClosedAt:
          executionStatus === "EXECUTED"
            ? change.operationalClosedAt ?? new Date(followupDate)
            : change.operationalClosedAt,
        effectivenessStatus: effectivenessStatus as "PENDING" | "ACCEPTABLE" | "NOT_ACCEPTABLE" | "NOT_APPLICABLE",
        finalStatus: followupFinalStatus(closeChange),
        effectiveClosedAt: closeChange ? new Date(followupDate) : null,
        closureConclusion: closeChange ? conclusion : change.closureConclusion,
      },
    });

    await tx.changeHistory.create({
      data: {
        qmsRecordId: change.qmsRecordId,
        changedByText: responsible,
        fieldPath: `followups[${sequenceNumber}]`,
        newValue: jsonValue({
          followupDate,
          executionStatus,
          effectivenessStatus,
          closeChange,
          nextFollowupDate,
          newTasks: newTaskInputs.length,
        }),
        reason: `Seguimiento ${String(sequenceNumber).padStart(2, "0")}`,
        source: "UI",
      },
    });

    const versionRecord = await tx.changeControl.findUniqueOrThrow({
      where: { id },
      include: {
        qmsRecord: true,
        tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        followups: {
          orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }],
          include: { taskStates: { orderBy: { createdAt: "asc" } } },
        },
        formVersion: true,
        annexIIITemplateVersion: true,
        annexIVTemplateVersion: true,
        annexVTemplateVersion: true,
      },
    });

    await startNextVersion(
      tx,
      change.qmsRecordId,
      "FOLLOWUP",
      snapshotJson(serializeChangeControlVersion(versionRecord)),
      responsible,
      `Seguimiento ${String(sequenceNumber).padStart(2, "0")}`,
      followup.id,
      "UI",
      sequenceNumber,
    );
  });

  revalidatePath("/changes");
  revalidatePath(`/changes/${id}`);
  redirect(`/changes/${id}?tab=followups`);
}


async function updateChangeControlFollowupActionAuthenticatedContent(
  id: string,
  followupId: string,
  _state: FollowupActionState,
  formData: FormData,
): Promise<FollowupActionState> {
  const change = await prisma.changeControl.findUnique({
    where: { id },
    include: {
      qmsRecord: true,
      tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: {
        orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }],
        include: { taskStates: { orderBy: { createdAt: "asc" } } },
      },
      formVersion: true,
      annexIIITemplateVersion: true,
      annexIVTemplateVersion: true,
      annexVTemplateVersion: true,
    },
  });
  if (!change) return { error: "Control de Cambio no encontrado." };
  const followup = change.followups.find((item) => item.id === followupId);
  if (!followup) return { error: "El seguimiento seleccionado no pertenece a este Control de Cambio." };

  const followupDate = String(formData.get("followupDate") ?? "").trim();
  const responsible = String(formData.get("responsible") ?? "").trim();
  const responsibleUserId = optionalUserId(formData.get("responsibleUserId")) ?? null;
  const observations = String(formData.get("observations") ?? "").trim();
  const executionStatus = String(formData.get("executionStatus") ?? "NOT_EXECUTED");
  const executionDate = String(formData.get("executionDate") ?? "").trim();
  const effectivenessStatus = String(formData.get("effectivenessStatus") ?? "PENDING");
  const effectivenessObservations = String(formData.get("effectivenessObservations") ?? "").trim();
  const closeChange = formData.get("closeChange") === "true";
  const nextFollowupDate = String(formData.get("nextFollowupDate") ?? "").trim();
  const remainOpenReason = String(formData.get("remainOpenReason") ?? "").trim();
  const conclusion = String(formData.get("conclusion") ?? "").trim();
  const approvalByText = String(formData.get("approvalByText") ?? "").trim();
  const tasks = parseFollowupTasks(String(formData.get("tasksJson") ?? "[]"));

  if (!followupDate || !responsible) return { error: "Fecha y responsable de seguimiento son obligatorios." };
  if (!["NOT_EXECUTED", "EXECUTED"].includes(executionStatus)) return { error: "Estado de ejecución no válido." };
  if (!["PENDING", "ACCEPTABLE", "NOT_ACCEPTABLE", "NOT_APPLICABLE"].includes(effectivenessStatus)) {
    return { error: "Estado de eficacia no válido." };
  }
  if (tasks.some((item) => item.isNew)) {
    return { error: "La edición histórica no permite introducir acciones nuevas retroactivamente." };
  }
  const followupUserProblem = await responsibleUsersProblem([responsibleUserId], [followup.responsibleUserId]);
  if (followupUserProblem) return { error: followupUserProblem };

  const expectedTaskIds = new Set(followup.taskStates.map((item) => item.taskId));
  const submittedTaskIds = new Set(tasks.map((item) => item.taskId).filter((value): value is string => Boolean(value)));
  if (
    expectedTaskIds.size !== submittedTaskIds.size ||
    [...expectedTaskIds].some((taskId) => !submittedTaskIds.has(taskId))
  ) {
    return { error: "La edición debe conservar exactamente las acciones registradas en este seguimiento." };
  }

  if (executionStatus === "EXECUTED") {
    if (!executionDate) return { error: "Un cambio Ejecutado requiere fecha de ejecución." };
    if (tasks.some((item) => item.status === "PENDING")) {
      return { error: "No se puede marcar Ejecutado mientras existan acciones pendientes." };
    }
  }
  if (closeChange) {
    if (executionStatus === "EXECUTED") {
      if (effectivenessStatus !== "ACCEPTABLE") {
        return { error: "El cierre efectivo de un cambio ejecutado requiere eficacia Aceptable." };
      }
    } else if (effectivenessStatus !== "NOT_APPLICABLE") {
      return { error: "Un cierre sin ejecución debe registrar la eficacia como No aplica." };
    }
    if (!conclusion) return { error: "El cierre requiere motivo/conclusión documentado." };
    if (!approvalByText) return { error: "Debe identificarse la aprobación del cierre." };
  } else if (!nextFollowupDate || !remainOpenReason) {
    return { error: "Si el cambio permanece abierto, debe indicarse motivo y próxima fecha de seguimiento." };
  }

  const latestSequence = Math.max(...change.followups.map((item) => item.sequenceNumber));
  const isLatest = followup.sequenceNumber === latestSequence;

  await prisma.$transaction(async (tx) => {
    await tx.changeControlFollowup.update({
      where: { id: followup.id },
      data: {
        followupDate: new Date(followupDate),
        responsible,
        responsibleUserId,
        observations: observations || null,
        executionStatus: executionStatus as "NOT_EXECUTED" | "EXECUTED",
        executionDate: toDate(executionDate),
        effectivenessStatus: effectivenessStatus as "PENDING" | "ACCEPTABLE" | "NOT_ACCEPTABLE" | "NOT_APPLICABLE",
        effectivenessObservations: effectivenessObservations || null,
        closeChange,
        nextFollowupDate: toDate(nextFollowupDate),
        remainOpenReason: remainOpenReason || null,
        conclusion: conclusion || null,
        approvalByText: approvalByText || null,
      },
    });

    for (const item of tasks) {
      if (!item.taskId) continue;
      await tx.changeControlTaskState.update({
        where: {
          followupId_taskId: {
            followupId: followup.id,
            taskId: item.taskId,
          },
        },
        data: {
          status: item.status,
          actualDate: toDate(item.actualDate),
          evidenceComment: item.evidenceComment || null,
        },
      });
    }

    if (isLatest) {
      await tx.changeControl.update({
        where: { id },
        data: {
          executionStatus: executionStatus as "NOT_EXECUTED" | "EXECUTED",
          executionDate: toDate(executionDate),
          operationalClosedAt:
            executionStatus === "EXECUTED"
              ? change.operationalClosedAt ?? new Date(followupDate)
              : null,
          effectivenessStatus: effectivenessStatus as "PENDING" | "ACCEPTABLE" | "NOT_ACCEPTABLE" | "NOT_APPLICABLE",
          finalStatus: followupFinalStatus(closeChange),
          effectiveClosedAt: closeChange ? new Date(followupDate) : null,
          closureConclusion: closeChange ? conclusion : null,
        },
      });
    }

    await tx.changeHistory.create({
      data: {
        qmsRecordId: change.qmsRecordId,
        changedByText: responsible,
        fieldPath: `followups[${followup.sequenceNumber}]`,
        oldValue: jsonValue({
          followupDate: followup.followupDate.toISOString().slice(0, 10),
          responsible: followup.responsible,
          executionStatus: followup.executionStatus,
          effectivenessStatus: followup.effectivenessStatus,
          closeChange: followup.closeChange,
          nextFollowupDate: followup.nextFollowupDate?.toISOString().slice(0, 10) ?? null,
        }),
        newValue: jsonValue({
          followupDate,
          responsible,
          executionStatus,
          effectivenessStatus,
          closeChange,
          nextFollowupDate,
        }),
        reason: `Corrección del Seguimiento ${String(followup.sequenceNumber).padStart(2, "0")}`,
        source: "UI",
      },
    });

    const version = await tx.qmsRecordVersion.findUnique({
      where: {
        qmsRecordId_sequenceNumber: {
          qmsRecordId: change.qmsRecordId,
          sequenceNumber: followup.sequenceNumber,
        },
      },
      select: { id: true, snapshot: true },
    });
    if (version) {
      const root = structuredClone(version.snapshot) as Record<string, unknown>;
      const section = root.changeControl as Record<string, unknown> | undefined;
      if (section && Array.isArray(section.followups)) {
        section.followups = section.followups.map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
          const current = entry as Record<string, unknown>;
          if (Number(current.sequenceNumber) !== followup.sequenceNumber) return entry;
          return {
            ...current,
            followupDate,
            responsible,
            responsibleUserId,
            observations: observations || null,
            executionStatus,
            executionDate: executionDate || null,
            effectivenessStatus,
            effectivenessObservations: effectivenessObservations || null,
            closeChange,
            nextFollowupDate: nextFollowupDate || null,
            remainOpenReason: remainOpenReason || null,
            conclusion: conclusion || null,
            approvalByText: approvalByText || null,
            taskStates: tasks.map((item) => ({
              taskId: item.taskId,
              status: item.status,
              actualDate: item.actualDate || null,
              evidenceComment: item.evidenceComment || null,
            })),
          };
        });
        if (isLatest) {
          section.executionStatus = executionStatus;
          section.executionDate = executionDate || null;
          section.effectivenessStatus = effectivenessStatus;
          section.finalStatus = followupFinalStatus(closeChange);
          section.effectiveClosedAt = closeChange ? followupDate : null;
          section.closureConclusion = closeChange ? conclusion : null;
        }
        await tx.qmsRecordVersion.update({
          where: { id: version.id },
          data: { snapshot: snapshotJson(root) },
        });
      }
    }
  });

  revalidatePath("/changes");
  revalidatePath(`/changes/${id}`);
  redirect(`/changes/${id}?tab=followups`);
}

export async function createChangeControlAction(...args: Parameters<typeof createChangeControlActionAuthenticatedContent>) {
  return authorizedAction("createChangeControlAction", args, authenticated => createChangeControlActionAuthenticatedContent(...authenticated as Parameters<typeof createChangeControlActionAuthenticatedContent>));
}

export async function updateChangeControlAction(...args: Parameters<typeof updateChangeControlActionAuthenticatedContent>) {
  return authorizedAction("updateChangeControlAction", args, authenticated => updateChangeControlActionAuthenticatedContent(...authenticated as Parameters<typeof updateChangeControlActionAuthenticatedContent>));
}

export async function addChangeControlFollowupAction(...args: Parameters<typeof addChangeControlFollowupActionAuthenticatedContent>) {
  return authorizedAction("addChangeControlFollowupAction", args, authenticated => addChangeControlFollowupActionAuthenticatedContent(...authenticated as Parameters<typeof addChangeControlFollowupActionAuthenticatedContent>));
}

export async function updateChangeControlFollowupAction(...args: Parameters<typeof updateChangeControlFollowupActionAuthenticatedContent>) {
  return authorizedAction("updateChangeControlFollowupAction", args, authenticated => updateChangeControlFollowupActionAuthenticatedContent(...authenticated as Parameters<typeof updateChangeControlFollowupActionAuthenticatedContent>));
}

