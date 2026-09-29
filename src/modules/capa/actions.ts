"use server";

import { Prisma, QmsRecordType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { persistenceFormError } from "@/lib/forms/persistence-error";
import {
  allowedIncomingRelationTypes,
  selectOperationalRelationTarget,
} from "@/lib/qms/relation-rules";
import { createQmsRelation } from "@/lib/qms/relation-service";
import {
  DeviationCapaPlanLinkError,
  getDeviationCapaPlanOrigin,
  registerDeviationCapaPlan,
} from "@/modules/capa/deviation-origin";
import {
  ComplaintCapaLinkError,
  getComplaintCapaPlanOrigin,
  getComplaintDirectOrigin,
  registerComplaintCapaPlan,
  registerComplaintDirectOrigin,
} from "@/modules/capa/complaint-origin";
import { parseCapaForm } from "@/modules/capa/validation";
import type { CapaFormState } from "@/modules/capa/types";
import type { RelationActionState } from "@/lib/qms/relation-form-types";
import type { FollowupActionState } from "@/components/basic-followup-form";
import {
  getApplicableFormVersion,
  getApplicableTemplateVersion,
} from "@/modules/configuration/runtime";
import {
  ensureInitialVersion,
  refreshCurrentVersion,
  serializeCapaVersion,
  snapshotJson,
  startNextVersion,
} from "@/lib/qms/versioning";

function toDate(value: string | null) {
  return value ? new Date(value) : null;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return { value: value === undefined ? null : value } as Prisma.InputJsonValue;
}

function snapshot(v: ReturnType<typeof parseCapaForm>["values"]) {
  return {
    businessCode: v.businessCode,
    actionType: v.actionType,
    departmentId: v.departmentId,
    openedAt: v.openedAt,
    createdByText: v.createdByText,
    originType: v.originType,
    originCode: v.originCode,
    applicableTo: v.applicableTo,
    defectDescription: v.defectDescription,
    rootCause: v.rootCause,
    impactAssessment: v.impactAssessment,
    status: v.status,
    cancellationReason: v.cancellationReason,
    operationalClosedAt: v.operationalClosedAt,
    effectivenessStatus: v.effectivenessStatus,
    effectivenessCriteria: v.effectivenessCriteria,
    effectivenessAssessment: v.effectivenessAssessment,
    effectivenessEvidence: v.effectivenessEvidence,
    effectiveClosedAt: v.effectiveClosedAt,
    conclusion: v.conclusion,
    internalObservations: v.internalObservations,
    signedDocumentAvailable: v.signedDocumentAvailable,
    dataQualityStatus: v.dataQualityStatus,
    plannedActions: v.plannedActions,
  };
}

async function relatePrimaryOrigin(
  tx: Prisma.TransactionClient,
  capaRecordId: string,
  originCode: string | null,
  actor: string,
) {
  if (!originCode) return;

  const allowedTypes = allowedIncomingRelationTypes(QmsRecordType.CAPA);
  const matches = await tx.qmsRecord.findMany({
    where: {
      businessCode: originCode.trim(),
      recordType: { in: allowedTypes },
      id: { not: capaRecordId },
    },
    select: { id: true, recordType: true, businessCode: true },
  });
  if (!matches.length) return;

  const origin = selectOperationalRelationTarget(QmsRecordType.CAPA, matches);
  await createQmsRelation(tx, {
    sourceRecordId: origin.id,
    targetRecordId: capaRecordId,
    createdByText: actor,
  });
}

export async function createCapaAction(
  _previous: CapaFormState,
  formData: FormData,
): Promise<CapaFormState> {
  const parsed = parseCapaForm(formData);
  if (parsed.errors.length) {
    return { error: "No se puede guardar la CAPA.", fieldErrors: parsed.errors, fieldIssues: parsed.fieldIssues };
  }
  const v = parsed.values;
  let capaId: string;
  try {
    const duplicate = await prisma.qmsRecord.findUnique({ where: { recordType_businessCode: { recordType: QmsRecordType.CAPA, businessCode: v.businessCode! } } });
    if (duplicate) return { error: "No se puede guardar la CAPA.", fieldErrors: ["Ya existe una CAPA con esa codificación."], fieldIssues: { businessCode: ["Ya existe una CAPA con esa codificación."] } };

    const department = await prisma.department.findUnique({ where: { id: v.departmentId! } });
    if (!department) return { error: "No se puede guardar la CAPA.", fieldErrors: ["El departamento seleccionado no existe."], fieldIssues: { departmentId: ["El departamento seleccionado no existe."] } };

    const referenceDate = toDate(v.openedAt) ?? new Date();
    const [formVersion, templateVersion] = await Promise.all([
      getApplicableFormVersion(QmsRecordType.CAPA, referenceDate),
      getApplicableTemplateVersion(QmsRecordType.CAPA, "CAPA_ANNEX_III", referenceDate),
    ]);

    const capa = await prisma.$transaction(async (tx) => {
      const deviationOrigin = v.fromDeviationPlanId
        ? await getDeviationCapaPlanOrigin(tx, v.fromDeviationPlanId)
        : null;
      const complaintPlanOrigin =
        !deviationOrigin && v.fromComplaintPlanId
          ? await getComplaintCapaPlanOrigin(tx, v.fromComplaintPlanId)
          : null;
      const complaintDirectOrigin =
        !deviationOrigin && !complaintPlanOrigin && v.fromComplaintId
          ? await getComplaintDirectOrigin(tx, v.fromComplaintId)
          : null;
      const canonicalValues = deviationOrigin
        ? {
            ...v,
            originType: "Desviación",
            originCode: deviationOrigin.deviationBusinessCode,
          }
        : complaintPlanOrigin
          ? {
              ...v,
              originType: "Reclamación",
              originCode: complaintPlanOrigin.complaintBusinessCode,
            }
          : complaintDirectOrigin
            ? {
                ...v,
                originType: "Reclamación",
                originCode: complaintDirectOrigin.complaintBusinessCode,
              }
            : v;

      const qmsRecord = await tx.qmsRecord.create({
        data: {
          recordType: QmsRecordType.CAPA,
          businessCode: v.businessCode,
          year: v.openedAt ? new Date(v.openedAt).getFullYear() : null,
        },
      });

      const created = await tx.capa.create({
        data: {
          qmsRecordId: qmsRecord.id,
          actionType: v.actionType,
          departmentId: department.id,
          departmentCodeSnapshot: department.code,
          departmentNameSnapshot: department.name,
          openedAt: toDate(v.openedAt),
          createdByText: v.createdByText,
          originType: canonicalValues.originType,
          originCode: canonicalValues.originCode,
          applicableTo: v.applicableTo,
          defectDescription: v.defectDescription,
          rootCause: v.rootCause,
          impactAssessment: v.impactAssessment,
          operationalClosedAt: toDate(v.operationalClosedAt),
          status: v.status,
          cancellationReason: v.cancellationReason,
          effectivenessStatus: v.effectivenessStatus,
          effectivenessCriteria: v.effectivenessCriteria,
          effectivenessAssessment: v.effectivenessAssessment,
          effectivenessEvidence: v.effectivenessEvidence,
          effectiveClosedAt: toDate(v.effectiveClosedAt),
          conclusion: v.conclusion,
          internalObservations: v.internalObservations,
          signedDocumentAvailable: v.signedDocumentAvailable,
          dataQualityStatus: v.dataQualityStatus,
          formVersionId: formVersion?.id,
          annexIIITemplateVersionId: templateVersion?.id,
          plannedActions: {
            create: v.plannedActions.map((item, index) => ({
              description: item.description,
              responsible: item.responsible || null,
              plannedExecutionDate: toDate(item.plannedExecutionDate),
              impact: item.impact || null,
              sortOrder: index,
            })),
          },
        },
      });

      await tx.changeHistory.create({
        data: {
          qmsRecordId: qmsRecord.id,
          changedByText: parsed.actor,
          fieldPath: "__created__",
          newValue: jsonValue(snapshot(canonicalValues)),
          source: "UI",
        },
      });

      const versionRecord = await tx.capa.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          qmsRecord: true,
          plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          followups: { orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }] },
          formVersion: true,
          annexIIITemplateVersion: true,
        },
      });
      await ensureInitialVersion(
        tx,
        qmsRecord.id,
        snapshotJson(serializeCapaVersion(versionRecord)),
        parsed.actor,
        "UI",
        "Informe inicial CAPA",
      );

      if (deviationOrigin) {
        await registerDeviationCapaPlan(tx, {
          planId: deviationOrigin.planId,
          capaQmsRecordId: qmsRecord.id,
          capaBusinessCode: v.businessCode!,
          actor: parsed.actor,
        });
      } else if (complaintPlanOrigin) {
        await registerComplaintCapaPlan(tx, {
          planId: complaintPlanOrigin.planId,
          capaQmsRecordId: qmsRecord.id,
          capaBusinessCode: v.businessCode!,
          actor: parsed.actor,
        });
      } else if (complaintDirectOrigin) {
        await registerComplaintDirectOrigin(tx, {
          complaintQmsRecordId: complaintDirectOrigin.complaintQmsRecordId,
          capaQmsRecordId: qmsRecord.id,
          actor: parsed.actor,
        });
      } else {
        await relatePrimaryOrigin(
          tx,
          qmsRecord.id,
          canonicalValues.originCode,
          parsed.actor,
        );
      }
      return created;
    });
    capaId = capa.id;
  } catch (error) {
    if (
      error instanceof DeviationCapaPlanLinkError ||
      error instanceof ComplaintCapaLinkError
    ) {
      return {
        error: "No se puede guardar la CAPA.",
        fieldErrors: [error.message],
      };
    }
    return persistenceFormError(error, "la CAPA", { duplicateField: "businessCode" });
  }

  revalidatePath("/capa");
  revalidatePath("/deviations");
  revalidatePath("/complaints");
  redirect(`/capa/${capaId}`);
}

export async function updateCapaAction(
  id: string,
  _previous: CapaFormState,
  formData: FormData,
): Promise<CapaFormState> {
  const parsed = parseCapaForm(formData, { allowHistoricalIncomplete: true });
  if (parsed.errors.length) {
    return { error: "No se puede guardar la CAPA.", fieldErrors: parsed.errors, fieldIssues: parsed.fieldIssues };
  }

  const existing = await prisma.capa.findUnique({
    where: { id },
    include: {
      qmsRecord: true,
      plannedActions: { orderBy: { sortOrder: "asc" } },
      followups: { orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }] },
      formVersion: true,
      annexIIITemplateVersion: true,
    },
  });
  if (!existing) return { error: "La CAPA ya no existe." };

  const v = parsed.values;

  if (existing.rootCause && !v.rootCause) {
    return { error: "No se puede eliminar una causa raíz ya documentada." };
  }

  if (existing.status !== "CLOSED" && v.status === "CLOSED") {
    const transitionErrors: string[] = [];
    if (!v.operationalClosedAt) transitionErrors.push("La transición a Cerrada requiere fecha de cierre operativo.");
    if (!v.conclusion) transitionErrors.push("La transición a Cerrada requiere conclusión de cierre.");
    const hasEvidence = existing.followups.some((item) => Boolean(item.evidenceReference?.trim()));
    if (!hasEvidence) transitionErrors.push("La transición a Cerrada requiere una evidencia de ejecución referenciada en un seguimiento.");
    if (transitionErrors.length) {
      return { error: "No se puede cerrar operativamente la CAPA.", fieldErrors: transitionErrors };
    }
  }

  if (existing.status !== "CANCELLED" && v.status === "CANCELLED" && !v.cancellationReason) {
    return { error: "La transición a Cancelada requiere motivo de cancelación." };
  }

  const isNewEffectiveClosure =
    !existing.effectiveClosedAt && Boolean(v.effectiveClosedAt);
  if (isNewEffectiveClosure) {
    const transitionErrors: string[] = [];
    if (v.status !== "CLOSED") transitionErrors.push("El cierre efectivo requiere estado Cerrada.");
    if (v.effectivenessStatus !== "CONFORMING") transitionErrors.push("El cierre efectivo requiere eficacia Conforme.");
    if (!v.effectivenessAssessment) transitionErrors.push("El cierre efectivo requiere valoración documentada de la eficacia.");
    if (transitionErrors.length) {
      return { error: "No se puede registrar el cierre efectivo.", fieldErrors: transitionErrors };
    }
  }
  const department = await prisma.department.findUnique({ where: { id: v.departmentId! } });
  if (!department) return { error: "No se puede guardar la CAPA.", fieldErrors: ["El departamento seleccionado no existe."], fieldIssues: { departmentId: ["El departamento seleccionado no existe."] } };

  const oldSnapshot = {
    businessCode: existing.qmsRecord.businessCode,
    actionType: existing.actionType,
    departmentId: existing.departmentId,
    openedAt: existing.openedAt?.toISOString().slice(0, 10) ?? null,
    createdByText: existing.createdByText,
    originType: existing.originType,
    originCode: existing.originCode,
    applicableTo: existing.applicableTo,
    defectDescription: existing.defectDescription,
    rootCause: existing.rootCause,
    impactAssessment: existing.impactAssessment,
    status: existing.status,
    cancellationReason: existing.cancellationReason,
    operationalClosedAt: existing.operationalClosedAt?.toISOString().slice(0, 10) ?? null,
    effectivenessStatus: existing.effectivenessStatus,
    effectivenessCriteria: existing.effectivenessCriteria,
    effectivenessAssessment: existing.effectivenessAssessment,
    effectivenessEvidence: existing.effectivenessEvidence,
    effectiveClosedAt: existing.effectiveClosedAt?.toISOString().slice(0, 10) ?? null,
    conclusion: existing.conclusion,
    internalObservations: existing.internalObservations,
    signedDocumentAvailable: existing.signedDocumentAvailable,
    dataQualityStatus: existing.dataQualityStatus,
    plannedActions: existing.plannedActions.map((item) => ({
      description: item.description,
      responsible: item.responsible ?? "",
      plannedExecutionDate: item.plannedExecutionDate?.toISOString().slice(0, 10) ?? "",
      impact: item.impact ?? "",
    })),
  };

  const newSnapshot = snapshot(v);
  const changed = Object.entries(newSnapshot).filter(([key, value]) => {
    return JSON.stringify((oldSnapshot as Record<string, unknown>)[key] ?? null) !==
      JSON.stringify(value ?? null);
  });

  try {
    await prisma.$transaction(async (tx) => {
      const storedVersion = await tx.qmsRecordVersion.findFirst({
        where: { qmsRecordId: existing.qmsRecordId },
        orderBy: { sequenceNumber: "desc" },
      });
      if (!storedVersion) {
        const historicalSequence = Math.max(
          0,
          ...existing.followups.map((item) => item.sequenceNumber),
        );
        await tx.qmsRecordVersion.create({
          data: {
            qmsRecordId: existing.qmsRecordId,
            sequenceNumber: historicalSequence,
            kind: "HISTORICAL_STATE",
            snapshot: snapshotJson(serializeCapaVersion(existing)),
            reason: "Baseline histórico al activar Hito 6.1; no reconstruye versiones anteriores no almacenadas",
            createdByText: parsed.actor,
            source: "SYSTEM",
          },
        });
      }

      await tx.qmsRecord.update({
        where: { id: existing.qmsRecordId },
        data: {
          businessCode: v.businessCode,
          year: v.openedAt ? new Date(v.openedAt).getFullYear() : null,
        },
      });
      await tx.capa.update({
        where: { id },
        data: {
          actionType: v.actionType,
          departmentId: department.id,
          departmentCodeSnapshot:
            existing.departmentId === department.id
              ? existing.departmentCodeSnapshot ?? department.code
              : department.code,
          departmentNameSnapshot:
            existing.departmentId === department.id
              ? existing.departmentNameSnapshot ?? department.name
              : department.name,
          openedAt: toDate(v.openedAt),
          createdByText: v.createdByText,
          originType: v.originType,
          originCode: v.originCode,
          applicableTo: v.applicableTo,
          defectDescription: v.defectDescription,
          rootCause: v.rootCause,
          impactAssessment: v.impactAssessment,
          operationalClosedAt: toDate(v.operationalClosedAt),
          status: v.status,
          cancellationReason: v.cancellationReason,
          effectivenessStatus: v.effectivenessStatus,
          effectivenessCriteria: v.effectivenessCriteria,
          effectivenessAssessment: v.effectivenessAssessment,
          effectivenessEvidence: v.effectivenessEvidence,
          effectiveClosedAt: toDate(v.effectiveClosedAt),
          conclusion: v.conclusion,
          internalObservations: v.internalObservations,
          signedDocumentAvailable: v.signedDocumentAvailable,
          dataQualityStatus: v.dataQualityStatus,
          plannedActions: {
            deleteMany: {},
            create: v.plannedActions.map((item, index) => ({
              description: item.description,
              responsible: item.responsible || null,
              plannedExecutionDate: toDate(item.plannedExecutionDate),
              impact: item.impact || null,
              sortOrder: index,
            })),
          },
        },
      });

      for (const [fieldPath, newValue] of changed) {
        await tx.changeHistory.create({
          data: {
            qmsRecordId: existing.qmsRecordId,
            changedByText: parsed.actor,
            fieldPath,
            oldValue: jsonValue((oldSnapshot as Record<string, unknown>)[fieldPath]),
            newValue: jsonValue(newValue),
            reason: v.changeReason,
            source: "UI",
          },
        });
      }
      await relatePrimaryOrigin(tx, existing.qmsRecordId, v.originCode, parsed.actor);

      const updatedForVersion = await tx.capa.findUniqueOrThrow({
        where: { id },
        include: {
          qmsRecord: true,
          plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          followups: { orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }] },
          formVersion: true,
          annexIIITemplateVersion: true,
        },
      });
      await refreshCurrentVersion(
        tx,
        existing.qmsRecordId,
        snapshotJson(serializeCapaVersion(updatedForVersion)),
        parsed.actor,
        v.changeReason || null,
      );
    });

    revalidatePath("/capa");
    revalidatePath(`/capa/${id}`);
    redirect(`/capa/${id}`);
  } catch (error) {
    return persistenceFormError(error, "la CAPA", { duplicateField: "businessCode" });
  }
}

export async function addCapaFollowupAction(id: string, _state: FollowupActionState, formData: FormData): Promise<FollowupActionState> {
  const capa = await prisma.capa.findUnique({
    where: { id },
    include: {
      qmsRecord: true,
      plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: { orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }] },
      formVersion: true,
      annexIIITemplateVersion: true,
    },
  });
  if (!capa) return { error: "CAPA no encontrada." };

  const date = String(formData.get("followupDate") ?? "").trim();
  const actor = String(formData.get("completedByText") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const observations = String(formData.get("observations") ?? "").trim();
  const evidenceReference = String(formData.get("evidenceReference") ?? "").trim();
  const next = String(formData.get("nextFollowupDate") ?? "").trim();

  if (!date || !actor || !description) {
    return { error: "Fecha, cumplimentado por y descripción son obligatorios." };
  }
  if (capa.status === "OPEN" && (!reason || !next)) {
    return { error: "Si la CAPA permanece abierta, el seguimiento debe indicar motivo y fecha del próximo seguimiento." };
  }

  const sequenceNumber =
    Math.max(0, ...capa.followups.map((item) => item.sequenceNumber)) + 1;

  try {
    await prisma.$transaction(async (tx) => {
      const existingVersion = await tx.qmsRecordVersion.findFirst({
        where: { qmsRecordId: capa.qmsRecordId },
        orderBy: { sequenceNumber: "desc" },
      });
      if (!existingVersion) {
        const historicalSequence = Math.max(0, ...capa.followups.map((item) => item.sequenceNumber));
        await tx.qmsRecordVersion.create({
          data: {
            qmsRecordId: capa.qmsRecordId,
            sequenceNumber: historicalSequence,
            kind: historicalSequence === 0 ? "INITIAL" : "HISTORICAL_STATE",
            snapshot: snapshotJson(serializeCapaVersion(capa)),
            reason:
              historicalSequence === 0
                ? "Informe inicial CAPA"
                : "Baseline histórico al activar Hito 6.1; no reconstruye versiones anteriores no almacenadas",
            createdByText: actor,
            source: historicalSequence === 0 ? "UI" : "SYSTEM",
          },
        });
      }

      const followup = await tx.capaFollowup.create({
        data: {
          capaId: id,
          sequenceNumber,
          followupDate: new Date(date),
          completedByText: actor,
          reason: reason || null,
          description,
          observations: observations || null,
          evidenceReference: evidenceReference || null,
          nextFollowupDate: next ? new Date(next) : null,
        },
      });
      await tx.changeHistory.create({
        data: {
          qmsRecordId: capa.qmsRecordId,
          changedByText: actor,
          fieldPath: `followups[${sequenceNumber}]`,
          newValue: jsonValue({
            followupDate: date,
            reason,
            description,
            observations,
            evidenceReference,
            nextFollowupDate: next,
          }),
          reason: "Nuevo seguimiento CAPA",
          source: "UI",
        },
      });

      const updatedForVersion = await tx.capa.findUniqueOrThrow({
        where: { id },
        include: {
          qmsRecord: true,
          plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          followups: { orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }] },
          formVersion: true,
          annexIIITemplateVersion: true,
        },
      });
      await startNextVersion(
        tx,
        capa.qmsRecordId,
        "FOLLOWUP",
        snapshotJson(serializeCapaVersion(updatedForVersion)),
        actor,
        reason || `Seguimiento CAPA ${String(sequenceNumber).padStart(2, "0")}`,
        followup.id,
        "UI",
        sequenceNumber,
      );
    });
  } catch (error) {
    return persistenceFormError(error, "el seguimiento de la CAPA");
  }

  revalidatePath("/capa");
  revalidatePath(`/capa/${id}`);
  return { success: `Seguimiento ${String(sequenceNumber).padStart(2, "0")} guardado correctamente.` };
}

export async function addCapaRelationAction(
  id: string,
  _state: RelationActionState,
  formData: FormData,
): Promise<RelationActionState> {
  try {
    const capa = await prisma.capa.findUnique({
      where: { id },
      select: { qmsRecordId: true, createdByText: true },
    });
    if (!capa) return { error: "CAPA no encontrada." };

    const code = String(formData.get("businessCode") ?? "").trim();
    const requestedType = String(formData.get("recordType") ?? "").trim() as QmsRecordType;
    const actor =
      String(formData.get("actor") ?? "").trim() ||
      capa.createdByText ||
      "Usuario demo";
    if (!code) return { error: "Debe indicarse la codificación del expediente de origen." };

    const allowedTypes = allowedIncomingRelationTypes(QmsRecordType.CAPA);
    if (!allowedTypes.includes(requestedType)) {
      return { error: "Una CAPA solo puede tener como origen una Desviación o una Reclamación." };
    }

    const matches = await prisma.qmsRecord.findMany({
      where: {
        businessCode: code,
        recordType: requestedType,
        id: { not: capa.qmsRecordId },
      },
      select: { id: true, recordType: true, businessCode: true },
    });
    const origin = selectOperationalRelationTarget(QmsRecordType.CAPA, matches);
    await createQmsRelation(prisma, {
      sourceRecordId: origin.id,
      targetRecordId: capa.qmsRecordId,
      createdByText: actor,
    });

    revalidatePath("/capa");
    revalidatePath("/deviations");
    revalidatePath("/complaints");
    revalidatePath(`/capa/${id}`);
    return { error: null, success: "Origen vinculado correctamente." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se ha podido vincular el origen." };
  }
}
