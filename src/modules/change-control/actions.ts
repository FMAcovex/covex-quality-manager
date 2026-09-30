"use server";

import type { FollowupActionState } from "@/components/basic-followup-form";

import {
  ChangeTaskOrigin,
  Prisma,
  QmsRecordType,
  QmsRelationType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { persistenceFormError } from "@/lib/forms/persistence-error";
import { preserveFormState } from "@/lib/forms/preserved-state";
import { createQmsRelation } from "@/lib/qms/relation-service";
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
    dictamenObservations: v.dictamenObservations,
    approvalNames: v.approvalNames,
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
      plannedDate: toDate(item.plannedDate),
      origin,
      introducedInFollowup,
      sortOrder: index,
    };
  });
}

export async function createChangeControlAction(
  previous: ChangeControlFormState,
  formData: FormData,
): Promise<ChangeControlFormState> {
  const parsed = parseChangeControlForm(formData);
  if (parsed.errors.length) {
    return preserveFormState(previous, formData, { error: "No se puede guardar el Control de Cambio.", fieldErrors: parsed.errors });
  }
  const v = parsed.values;
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
          dictamenObservations: v.dictamenObservations,
          approvalNames: v.approvalNames,
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

export async function updateChangeControlAction(
  id: string,
  previous: ChangeControlFormState,
  formData: FormData,
): Promise<ChangeControlFormState> {
  const parsed = parseChangeControlForm(formData);
  if (parsed.errors.length) {
    return preserveFormState(previous, formData, { error: "No se puede guardar el Control de Cambio.", fieldErrors: parsed.errors });
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
  v.businessCode = existing.qmsRecord.businessCode;
  const department = await prisma.department.findUnique({ where: { id: v.departmentId! } });
  if (!department) return preserveFormState(previous, formData, { error: "El departamento seleccionado no existe." });

  if (existing.dictamenResult === "APPROVED") {
    const oldBaseline = existing.tasks
      .filter((item) => item.origin === "DICTAMEN")
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
    evaluation: existing.evaluation,
    classification: existing.classification,
    plannedImplementationDate: existing.plannedImplementationDate?.toISOString().slice(0, 10) ?? null,
    dictamenResult: existing.dictamenResult,
    dictamenDate: existing.dictamenDate?.toISOString().slice(0, 10) ?? null,
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.qmsRecord.update({
        where: { id: existing.qmsRecordId },
        data: {
          businessCode: existing.qmsRecord.businessCode,
          year: v.requestDate ? new Date(v.requestDate).getFullYear() : null,
        },
      });

      await tx.changeControl.update({
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
          dictamenObservations: v.dictamenObservations,
          approvalNames: v.approvalNames,
          internalObservations: v.internalObservations,
          signedDocumentAvailable: v.signedDocumentAvailable,
          dataQualityStatus: v.dataQualityStatus,
        },
      });

      if (existing.dictamenResult !== "APPROVED") {
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

    revalidatePath("/changes");
    revalidatePath(`/changes/${id}`);
    redirect(`/changes/${id}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return preserveFormState(previous, formData, { error: "Ya existe un Control de Cambio con esa codificación." });
    }
    return preserveFormState(previous, formData, persistenceFormError(error, "el Control de Cambio"));
  }
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
        plannedDate: typeof item.plannedDate === "string" ? item.plannedDate : "",
        status:
          item.status === "COMPLETED" || item.status === "NOT_APPLICABLE"
            ? item.status
            : "PENDING",
        actualDate: typeof item.actualDate === "string" ? item.actualDate : "",
        evidenceComment: typeof item.evidenceComment === "string" ? item.evidenceComment.trim() : "",
        isNew: item.isNew === true,
      }))
      .filter((item) => item.description && item.departmentId);
  } catch {
    return [];
  }
}

export async function addChangeControlFollowupAction(id: string, _state: FollowupActionState, formData: FormData): Promise<FollowupActionState> {
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
  if (change.dictamenResult !== "APPROVED") {
    return { error: "Solo se puede registrar seguimiento cuando el Dictamen está aprobado." };
  }

  const followupDate = String(formData.get("followupDate") ?? "").trim();
  const responsible = String(formData.get("responsible") ?? "").trim();
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
        finalStatus: closeChange ? "CLOSED" : "OPEN",
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

export async function addChangeControlRelationAction(id: string, formData: FormData) {
  const change = await prisma.changeControl.findUnique({ where: { id } });
  if (!change) {
    redirect(`/changes/${id}?tab=relations&relationError=${encodeURIComponent("Control de Cambio no encontrado.")}`);
  }
  const businessCode = String(formData.get("businessCode") ?? "").trim();
  const relationType = String(formData.get("relationType") ?? "RELATED_TO");
  const actor = String(formData.get("actor") ?? process.env.DEFAULT_ACTOR_NAME ?? "Usuario demo").trim();
  const relationTypes = Object.values(QmsRelationType) as string[];
  if (!businessCode || !relationTypes.includes(relationType)) {
    redirect(`/changes/${id}?tab=relations&relationError=${encodeURIComponent("Relación incompleta.")}`);
  }

  const target = await prisma.qmsRecord.findFirst({
    where: { businessCode, id: { not: change.qmsRecordId } },
  });
  if (!target) {
    redirect(`/changes/${id}?tab=relations&relationError=${encodeURIComponent("No existe un expediente con esa codificación.")}`);
  }

  try {
    await createQmsRelation(prisma, {
      sourceRecordId: change.qmsRecordId,
      targetRecordId: target.id,
      relationType: relationType as QmsRelationType,
      createdByText: actor,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "No se ha podido crear la relación QMS.";
    redirect(`/changes/${id}?tab=relations&relationError=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/changes/${id}`);
  redirect(`/changes/${id}?tab=relations`);
}
