"use server";

import { Prisma, QmsRecordType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { persistenceFormError } from "@/lib/forms/persistence-error";
import { preserveFormState } from "@/lib/forms/preserved-state";
import {
  allowedIncomingRelationTypes,
  selectOperationalRelationTarget,
} from "@/lib/qms/relation-rules";
import {
  createQmsRelation,
  deactivateOperationalRelation,
  linkOperationalRelationByBusinessCode,
} from "@/lib/qms/relation-service";
import {
  assignOperationalBusinessCode,
  OperationalBusinessCodeError,
} from "@/lib/qms/business-code";
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
import { saveCapaFollowup } from "@/modules/capa/followup-service";
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
  previous: CapaFormState,
  formData: FormData,
): Promise<CapaFormState> {
  const parsed = parseCapaForm(formData);
  if (parsed.errors.length) {
    return preserveFormState(previous, formData, { error: "No se puede guardar la CAPA.", fieldErrors: parsed.errors, fieldIssues: parsed.fieldIssues });
  }
  const v = parsed.values;
  let capaId: string;
  try {
    const department = v.departmentId
      ? await prisma.department.findUnique({ where: { id: v.departmentId } })
      : null;
    if (v.status !== "DRAFT" && !department) {
      return preserveFormState(previous, formData, { error: "No se puede guardar la CAPA.", fieldErrors: ["El departamento seleccionado no existe."], fieldIssues: { departmentId: ["El departamento seleccionado no existe."] } });
    }

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

      const openingYear = v.openedAt ? new Date(v.openedAt).getFullYear() : null;
      let businessCode = v.businessCode;
      if (department && openingYear && (v.status !== "DRAFT" || businessCode)) {
        businessCode = await assignOperationalBusinessCode(tx, {
          recordType: QmsRecordType.CAPA,
          year: openingYear,
          departmentCode: department.code,
          actionType: v.actionType,
          requestedCode: businessCode,
        });
      } else if (v.status !== "DRAFT") {
        throw new OperationalBusinessCodeError(
          "INVALID_FORMAT",
          "Para abrir la CAPA deben estar informados departamento y fecha de apertura.",
        );
      } else {
        businessCode = null;
      }
      v.businessCode = businessCode;

      const qmsRecord = await tx.qmsRecord.create({
        data: {
          recordType: QmsRecordType.CAPA,
          businessCode,
          year: openingYear,
        },
      });

      const created = await tx.capa.create({
        data: {
          qmsRecordId: qmsRecord.id,
          actionType: v.actionType,
          departmentId: department?.id ?? null,
          departmentCodeSnapshot: department?.code ?? null,
          departmentNameSnapshot: department?.name ?? null,
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
          extraData: v.status === "DRAFT"
            ? {
                pendingOrigin: {
                  deviationPlanId: deviationOrigin?.planId ?? null,
                  complaintPlanId: complaintPlanOrigin?.planId ?? null,
                  complaintId: v.fromComplaintId ?? null,
                },
              }
            : undefined,
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
        v.status === "DRAFT" ? "Borrador inicial CAPA" : "Informe inicial CAPA",
      );

      if (v.status === "DRAFT") {
        return created;
      }

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
    if (error instanceof OperationalBusinessCodeError) {
      return preserveFormState(previous, formData, {
        error: "No se puede guardar la CAPA.",
        fieldErrors: [error.message],
        fieldIssues: { businessCode: [error.message] },
      });
    }
    if (
      error instanceof DeviationCapaPlanLinkError ||
      error instanceof ComplaintCapaLinkError
    ) {
      return preserveFormState(previous, formData, {
        error: "No se puede guardar la CAPA.",
        fieldErrors: [error.message],
      });
    }
    return preserveFormState(previous, formData, persistenceFormError(error, "la CAPA", { duplicateField: "businessCode" }));
  }

  revalidatePath("/capa");
  revalidatePath("/deviations");
  revalidatePath("/complaints");
  redirect(`/capa/${capaId}`);
}

export async function updateCapaAction(
  id: string,
  previous: CapaFormState,
  formData: FormData,
): Promise<CapaFormState> {
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
  if (!existing) return preserveFormState(previous, formData, { error: "La CAPA ya no existe." });

  const parsed = parseCapaForm(formData, { allowHistoricalIncomplete: existing.status !== "DRAFT" });
  if (parsed.errors.length) {
    return preserveFormState(previous, formData, { error: "No se puede guardar la CAPA.", fieldErrors: parsed.errors, fieldIssues: parsed.fieldIssues });
  }

  const v = parsed.values;
  const requestedBusinessCode = v.businessCode;
  v.businessCode = existing.qmsRecord.businessCode ?? requestedBusinessCode;
  if (existing.status !== "DRAFT" && v.status === "DRAFT") {
    return preserveFormState(previous, formData, {
      error: "No se puede volver a borrador una CAPA ya operativa.",
      fieldErrors: ["Una CAPA abierta, cerrada o cancelada no puede volver al estado Borrador."],
      fieldIssues: { status: ["Una CAPA abierta, cerrada o cancelada no puede volver al estado Borrador."] },
    });
  }

  if (existing.rootCause && !v.rootCause && v.status !== "DRAFT") {
    return preserveFormState(previous, formData, { error: "No se puede eliminar una causa raíz ya documentada." });
  }

  if (existing.status !== "CLOSED" && v.status === "CLOSED") {
    const transitionErrors: string[] = [];
    if (!v.operationalClosedAt) transitionErrors.push("La transición a Cerrada requiere fecha de cierre operativo.");
    if (!v.conclusion) transitionErrors.push("La transición a Cerrada requiere conclusión de cierre.");
    const hasEvidence = existing.followups.some((item) => Boolean(item.evidenceReference?.trim()));
    if (!hasEvidence) transitionErrors.push("La transición a Cerrada requiere una evidencia de ejecución referenciada en un seguimiento.");
    if (transitionErrors.length) {
      return preserveFormState(previous, formData, { error: "No se puede cerrar operativamente la CAPA.", fieldErrors: transitionErrors });
    }
  }

  if (existing.status !== "CANCELLED" && v.status === "CANCELLED" && !v.cancellationReason) {
    return preserveFormState(previous, formData, { error: "La transición a Cancelada requiere motivo de cancelación." });
  }

  const isNewEffectiveClosure =
    !existing.effectiveClosedAt && Boolean(v.effectiveClosedAt);
  if (isNewEffectiveClosure) {
    const transitionErrors: string[] = [];
    if (v.status !== "CLOSED") transitionErrors.push("El cierre efectivo requiere estado Cerrada.");
    if (v.effectivenessStatus !== "CONFORMING") transitionErrors.push("El cierre efectivo requiere eficacia Conforme.");
    if (!v.effectivenessAssessment) transitionErrors.push("El cierre efectivo requiere valoración documentada de la eficacia.");
    if (transitionErrors.length) {
      return preserveFormState(previous, formData, { error: "No se puede registrar el cierre efectivo.", fieldErrors: transitionErrors });
    }
  }
  const department = v.departmentId
    ? await prisma.department.findUnique({ where: { id: v.departmentId } })
    : null;
  if (v.status !== "DRAFT" && !department) {
    return preserveFormState(previous, formData, { error: "No se puede guardar la CAPA.", fieldErrors: ["El departamento seleccionado no existe."], fieldIssues: { departmentId: ["El departamento seleccionado no existe."] } });
  }

  const pendingOrigin =
    existing.status === "DRAFT" && existing.extraData && typeof existing.extraData === "object" && !Array.isArray(existing.extraData)
      ? (existing.extraData as { pendingOrigin?: { deviationPlanId?: string | null; complaintPlanId?: string | null; complaintId?: string | null } }).pendingOrigin
      : undefined;
  const becomingOperational = existing.status === "DRAFT" && v.status !== "DRAFT";

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

      const openingYear = v.openedAt ? new Date(v.openedAt).getFullYear() : null;
      let businessCode = existing.qmsRecord.businessCode;
      if (existing.status === "DRAFT" && department && openingYear) {
        if (!businessCode && (v.status !== "DRAFT" || requestedBusinessCode)) {
          businessCode = await assignOperationalBusinessCode(tx, {
            recordType: QmsRecordType.CAPA,
            year: openingYear,
            departmentCode: department.code,
            actionType: v.actionType,
            requestedCode: requestedBusinessCode,
            excludeQmsRecordId: existing.qmsRecordId,
          });
        } else if (businessCode && requestedBusinessCode && requestedBusinessCode !== businessCode) {
          businessCode = await assignOperationalBusinessCode(tx, {
            recordType: QmsRecordType.CAPA,
            year: openingYear,
            departmentCode: department.code,
            actionType: v.actionType,
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
          year: openingYear,
        },
      });
      await tx.capa.update({
        where: { id },
        data: {
          actionType: v.actionType,
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
          extraData: becomingOperational ? Prisma.DbNull : existing.extraData ?? undefined,
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
      if (becomingOperational) {
        if (pendingOrigin?.deviationPlanId) {
          await registerDeviationCapaPlan(tx, {
            planId: pendingOrigin.deviationPlanId,
            capaQmsRecordId: existing.qmsRecordId,
            capaBusinessCode: businessCode!,
            actor: parsed.actor,
          });
        } else if (pendingOrigin?.complaintPlanId) {
          await registerComplaintCapaPlan(tx, {
            planId: pendingOrigin.complaintPlanId,
            capaQmsRecordId: existing.qmsRecordId,
            capaBusinessCode: businessCode!,
            actor: parsed.actor,
          });
        } else if (pendingOrigin?.complaintId) {
          const complaintOrigin = await getComplaintDirectOrigin(tx, pendingOrigin.complaintId);
          await registerComplaintDirectOrigin(tx, {
            complaintQmsRecordId: complaintOrigin.complaintQmsRecordId,
            capaQmsRecordId: existing.qmsRecordId,
            actor: parsed.actor,
          });
        } else {
          await relatePrimaryOrigin(tx, existing.qmsRecordId, v.originCode, parsed.actor);
        }
      } else if (v.status !== "DRAFT") {
        await relatePrimaryOrigin(tx, existing.qmsRecordId, v.originCode, parsed.actor);
      }

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
    if (error instanceof OperationalBusinessCodeError) {
      return preserveFormState(previous, formData, {
        error: "No se puede guardar la CAPA.",
        fieldErrors: [error.message],
        fieldIssues: { businessCode: [error.message] },
      });
    }
    if (error instanceof DeviationCapaPlanLinkError || error instanceof ComplaintCapaLinkError) {
      return preserveFormState(previous, formData, {
        error: "No se puede abrir la CAPA.",
        fieldErrors: [error.message],
      });
    }
    return preserveFormState(previous, formData, persistenceFormError(error, "la CAPA", { duplicateField: "businessCode" }));
  }
}

export async function addCapaFollowupAction(
  id: string,
  _state: FollowupActionState,
  formData: FormData,
): Promise<FollowupActionState> {
  const result = await saveCapaFollowup(id, formData);
  if (result.success) {
    revalidatePath("/capa");
    revalidatePath(`/capa/${id}`);
  }
  return result;
}

export async function addCapaRelationAction(
  id: string,
  _state: RelationActionState,
  formData: FormData,
): Promise<RelationActionState> {
  try {
    const capa = await prisma.capa.findUnique({
      where: { id },
      select: { qmsRecordId: true, createdByText: true, status: true },
    });
    if (!capa) return { error: "CAPA no encontrada." };
    if (capa.status === "DRAFT") {
      return { error: "La CAPA debe estar abierta antes de vincular expedientes de origen." };
    }

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

    await linkOperationalRelationByBusinessCode(prisma, {
      currentRecordId: capa.qmsRecordId,
      currentType: QmsRecordType.CAPA,
      relatedType: requestedType,
      businessCode: code,
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


export async function unlinkCapaOriginAction(
  capaId: string,
  sourceQmsRecordId: string,
  formData: FormData,
) {
  const actor = String(
    formData.get("actor") ?? process.env.DEFAULT_ACTOR_NAME ?? "Usuario demo",
  ).trim();

  const capa = await prisma.capa.findUnique({
    where: { id: capaId },
    select: { qmsRecordId: true },
  });
  if (!capa) throw new Error("La CAPA no existe.");

  await prisma.$transaction((tx) =>
    deactivateOperationalRelation(tx, {
      currentRecordId: capa.qmsRecordId,
      relatedRecordId: sourceQmsRecordId,
      changedByText: actor,
      reason: "Desvinculación de expediente de origen",
    }),
  );

  revalidatePath("/deviations");
  revalidatePath("/complaints");
  revalidatePath("/capa");
  revalidatePath(`/capa/${capaId}`);
}
