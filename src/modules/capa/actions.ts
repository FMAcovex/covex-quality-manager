"use server";
import { attributeAuditFinding } from "@/modules/audits/finding-service";
import { authorizedAction } from "@/lib/auth/action-guard";
import { qmsDetailUrl } from "@/lib/qms/list-return-navigation";

import { Prisma, QmsRecordType, RecordVersionKind, RootCauseCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { refreshCapaVersionAfterRelationChange } from "./relation-version-service";
import { prisma } from "@/lib/db";
import { responsibleUsersProblem } from "@/lib/auth/app-users";
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
  syncOperationalOriginRelations,
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
  capaSnapshotVersionFollowupDate,
  ensureInitialVersion,
  refreshCurrentVersion,
  startNextVersion,
  serializeCapaVersion,
  snapshotJson,
} from "@/lib/qms/versioning";
import { keepsOperationalStatus } from "@/modules/lifecycle";

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
    versionFollowupDate: v.versionFollowupDate,
    createdByText: v.createdByText,
    originType: v.originType,
    originCode: v.originCode,
    applicableTo: v.applicableTo,
    defectDescription: v.defectDescription,
    rootCause: v.rootCause,
    rootCauseCategories: v.rootCauseCategories,
    impactAssessment: v.impactAssessment,
    nextFollowupDate: v.nextFollowupDate,
    actionFollowupObservations: v.actionFollowupObservations,
    actionFollowups: v.actionFollowups,
    operationalStatusDescription: v.operationalStatusDescription,
    origins: v.origins,
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

async function createCapaActionAuthenticatedContent(
  previous: CapaFormState,
  formData: FormData,
): Promise<CapaFormState> {
  const parsed = parseCapaForm(formData);
  if (parsed.errors.length) {
    return preserveFormState(previous, formData, { error: "No se puede guardar la CAPA.", fieldErrors: parsed.errors, fieldIssues: parsed.fieldIssues });
  }
  const v = parsed.values;
  const userProblem = await responsibleUsersProblem(v.plannedActions.map((item) => item.responsibleUserId));
  if (userProblem) return preserveFormState(previous, formData, { error: "No se puede guardar la CAPA.", fieldErrors: [userProblem], fieldIssues: { plannedActionsJson: [userProblem] } });
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
          rootCauseCategories: v.rootCauseCategories as RootCauseCategory[],
          impactAssessment: v.impactAssessment,
          nextFollowupDate: toDate(v.nextFollowupDate),
          actionFollowupObservations: v.actionFollowupObservations,
          operationalStatusDescription: v.operationalStatusDescription,
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
                pendingOriginIds: v.origins.map((item) => item.id),
              }
            : undefined,
          plannedActions: {
            create: v.plannedActions.map((item, index) => ({
              description: item.description,
              responsible: item.responsible || null,
              responsibleUserId: item.responsibleUserId ?? null,
              plannedExecutionDate: toDate(item.plannedExecutionDate),
              impact: item.impact || null,
              sortOrder: index,
            })),
          },
          actionFollowups: {
            create: v.actionFollowups.map((item, index) => ({
              followupDate: toDate(item.followupDate),
              description: item.description || null,
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
          newValue: jsonValue({
            ...snapshot(v),
            originType: canonicalValues.originType,
            originCode: canonicalValues.originCode,
          }),
          source: "UI",
        },
      });

      if (v.status !== "DRAFT") {
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
        } else if (!v.origins.length) {
          await relatePrimaryOrigin(
            tx,
            qmsRecord.id,
            canonicalValues.originCode,
            parsed.actor,
          );
        }

        const selectedOriginIds = new Set(v.origins.map((item) => item.id));
        if (deviationOrigin?.deviationQmsRecordId) selectedOriginIds.add(deviationOrigin.deviationQmsRecordId);
        if (complaintPlanOrigin?.complaintQmsRecordId) selectedOriginIds.add(complaintPlanOrigin.complaintQmsRecordId);
        if (complaintDirectOrigin?.complaintQmsRecordId) selectedOriginIds.add(complaintDirectOrigin.complaintQmsRecordId);
        if (selectedOriginIds.size) {
          await syncOperationalOriginRelations(tx, {
            capaRecordId: qmsRecord.id,
            originRecordIds: [...selectedOriginIds],
            changedByText: parsed.actor,
          });
        }
      }

      // R5B2: CAPA abierta desde un hallazgo de auditoría; solo se atribuye si la auditoría sigue entre los orígenes.
      const fromAuditFindingId = String(formData.get("fromAuditFindingId") ?? "").trim();
      if (fromAuditFindingId) {
        const finding = await tx.auditFinding.findUnique({ where: { id: fromAuditFindingId }, select: { audit: { select: { qmsRecordId: true } } } });
        if (finding && v.origins.some((origin) => origin.id === finding.audit.qmsRecordId)) await attributeAuditFinding(tx, { findingId: fromAuditFindingId, targetRecordId: qmsRecord.id, actor: parsed.actor });
      }

      const versionRecord = await tx.capa.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          qmsRecord: {
            include: {
              targetRelations: {
                where: { isActive: true, relationType: "GENERATES" },
                include: { sourceRecord: true, auditFindingRelations: { where: { isActive: true }, include: { finding: { select: { id: true, reference: true } } } } },
              },
            },
          },
          plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          actionFollowups: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          followups: { orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }] },
          formVersion: true,
          annexIIITemplateVersion: true,
        },
      });
      await ensureInitialVersion(
        tx,
        qmsRecord.id,
        snapshotJson(
          serializeCapaVersion(versionRecord, {
            versionFollowupDate: versionRecord.openedAt,
          }),
        ),
        parsed.actor,
        "UI",
        v.status === "DRAFT" ? "Borrador inicial CAPA" : "Informe inicial CAPA",
      );

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

async function updateCapaActionAuthenticatedContent(
  id: string,
  previous: CapaFormState,
  formData: FormData,
): Promise<CapaFormState> {
  const existing = await prisma.capa.findUnique({
    where: { id },
    include: {
      qmsRecord: {
        include: {
          targetRelations: {
            where: { isActive: true, relationType: "GENERATES" },
            include: { sourceRecord: true, auditFindingRelations: { where: { isActive: true }, include: { finding: { select: { id: true, reference: true } } } } },
          },
        },
      },
      plannedActions: { orderBy: { sortOrder: "asc" } },
      actionFollowups: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: { orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }] },
      formVersion: true,
      annexIIITemplateVersion: true,
    },
  });
  if (!existing) return preserveFormState(previous, formData, { error: "La CAPA ya no existe." });

  const parsed = parseCapaForm(formData);
  if (parsed.errors.length) {
    return preserveFormState(previous, formData, { error: "No se puede guardar la CAPA.", fieldErrors: parsed.errors, fieldIssues: parsed.fieldIssues });
  }

  const v = parsed.values;
  const userProblem = await responsibleUsersProblem(v.plannedActions.map((item) => item.responsibleUserId), existing.plannedActions.map((item) => item.responsibleUserId));
  if (userProblem) return preserveFormState(previous, formData, { error: "No se puede guardar la CAPA.", fieldErrors: [userProblem], fieldIssues: { plannedActionsJson: [userProblem] } });
  const historyReason = v.saveIntent === "CREATE_FOLLOWUP_VERSION" ? v.changeReason : null;
  const requestedBusinessCode = v.businessCode;
  v.businessCode = existing.qmsRecord.businessCode ?? requestedBusinessCode;
  if (!keepsOperationalStatus(existing.status, v.status)) {
    return preserveFormState(previous, formData, {
      error: "No se puede volver a borrador una CAPA ya operativa.",
      fieldErrors: ["Una CAPA abierta, cerrada o cancelada no puede volver al estado Borrador."],
      fieldIssues: { status: ["Una CAPA abierta, cerrada o cancelada no puede volver al estado Borrador."] },
    });
  }

  if (existing.rootCause && !v.rootCause && v.status !== "DRAFT") {
    return preserveFormState(previous, formData, { error: "No se puede eliminar una causa raíz ya documentada." });
  }

  if (existing.status !== "CLOSED" && v.status === "CLOSED" && !v.operationalClosedAt) {
    return preserveFormState(previous, formData, {
      error: "No se puede cerrar operativamente la CAPA.",
      fieldErrors: ["La transición a Cerrada requiere fecha de cierre y ejecución."],
      fieldIssues: { operationalClosedAt: ["La transición a Cerrada requiere fecha de cierre y ejecución."] },
    });
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

  const pendingData =
    existing.status === "DRAFT" && existing.extraData && typeof existing.extraData === "object" && !Array.isArray(existing.extraData)
      ? (existing.extraData as {
          pendingOrigin?: { deviationPlanId?: string | null; complaintPlanId?: string | null; complaintId?: string | null };
          pendingOriginIds?: string[];
        })
      : undefined;
  const pendingOrigin = pendingData?.pendingOrigin;
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
    rootCauseCategories: existing.rootCauseCategories,
    impactAssessment: existing.impactAssessment,
    nextFollowupDate: existing.nextFollowupDate?.toISOString().slice(0, 10) ?? null,
    actionFollowupObservations: existing.actionFollowupObservations,
    operationalStatusDescription: existing.operationalStatusDescription,
    actionFollowups: existing.actionFollowups.map((item) => ({
      followupDate: item.followupDate?.toISOString().slice(0, 10) ?? "",
      description: item.description ?? "",
    })),
    origins: existing.qmsRecord.targetRelations
      .filter((item) => item.sourceRecord.recordType === "DEVIATION" || item.sourceRecord.recordType === "COMPLAINT" || item.sourceRecord.recordType === "AUDIT")
      .map((item) => ({
        id: item.sourceRecord.id,
        recordType: item.sourceRecord.recordType,
        businessCode: item.sourceRecord.businessCode ?? "",
        year: item.sourceRecord.year,
      })),
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
      responsibleUserId: item.responsibleUserId,
      plannedExecutionDate: item.plannedExecutionDate?.toISOString().slice(0, 10) ?? "",
      impact: item.impact ?? "",
    })),
  };

  const newSnapshot = {
    ...snapshot(v),
    impactAssessment: existing.impactAssessment,
    effectivenessCriteria: existing.effectivenessCriteria,
    effectivenessEvidence: existing.effectivenessEvidence,
    signedDocumentAvailable: existing.signedDocumentAvailable,
  };
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
            snapshot: snapshotJson(
              serializeCapaVersion(existing, {
                versionFollowupDate:
                  historicalSequence === 0
                    ? existing.openedAt
                    : existing.followups.find((item) => item.sequenceNumber === historicalSequence)?.followupDate ?? null,
              }),
            ),
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
          rootCauseCategories: v.rootCauseCategories as RootCauseCategory[],
          impactAssessment: existing.impactAssessment,
          nextFollowupDate: toDate(v.nextFollowupDate),
          actionFollowupObservations: v.actionFollowupObservations,
          operationalStatusDescription: v.operationalStatusDescription,
          operationalClosedAt: toDate(v.operationalClosedAt),
          status: v.status,
          cancellationReason: v.cancellationReason,
          effectivenessStatus: v.effectivenessStatus,
          effectivenessCriteria: existing.effectivenessCriteria,
          effectivenessAssessment: v.effectivenessAssessment,
          effectivenessEvidence: existing.effectivenessEvidence,
          effectiveClosedAt: toDate(v.effectiveClosedAt),
          conclusion: v.conclusion,
          internalObservations: v.internalObservations,
          signedDocumentAvailable: existing.signedDocumentAvailable,
          dataQualityStatus: v.dataQualityStatus,
          extraData: becomingOperational
            ? Prisma.DbNull
            : v.status === "DRAFT"
              ? {
                  ...((existing.extraData && typeof existing.extraData === "object" && !Array.isArray(existing.extraData))
                    ? existing.extraData as Prisma.JsonObject
                    : {}),
                  pendingOriginIds: v.origins.map((item) => item.id),
                }
              : existing.extraData ?? undefined,
          plannedActions: {
            deleteMany: {},
            create: v.plannedActions.map((item, index) => ({
              description: item.description,
              responsible: item.responsible || null,
              responsibleUserId: item.responsibleUserId ?? null,
              plannedExecutionDate: toDate(item.plannedExecutionDate),
              impact: item.impact || null,
              sortOrder: index,
            })),
          },
          actionFollowups: {
            deleteMany: {},
            create: v.actionFollowups.map((item, index) => ({
              followupDate: toDate(item.followupDate),
              description: item.description || null,
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
            reason: historyReason,
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
      } else if (v.status !== "DRAFT" && !v.origins.length) {
        await relatePrimaryOrigin(tx, existing.qmsRecordId, v.originCode, parsed.actor);
      }

      if (v.status !== "DRAFT") {
        const selectedOriginIds = new Set(v.origins.map((item) => item.id));
        if (pendingOrigin?.deviationPlanId) {
          const plan = await tx.deviationCapaPlan.findUnique({
            where: { id: pendingOrigin.deviationPlanId },
            select: { deviation: { select: { qmsRecordId: true } } },
          });
          if (plan) selectedOriginIds.add(plan.deviation.qmsRecordId);
        }
        if (pendingOrigin?.complaintPlanId) {
          const plan = await tx.complaintCapaPlan.findUnique({
            where: { id: pendingOrigin.complaintPlanId },
            select: { complaint: { select: { qmsRecordId: true } } },
          });
          if (plan) selectedOriginIds.add(plan.complaint.qmsRecordId);
        }
        if (pendingOrigin?.complaintId) {
          const complaint = await tx.complaint.findUnique({
            where: { id: pendingOrigin.complaintId },
            select: { qmsRecordId: true },
          });
          if (complaint) selectedOriginIds.add(complaint.qmsRecordId);
        }
        await syncOperationalOriginRelations(tx, {
          capaRecordId: existing.qmsRecordId,
          originRecordIds: [...selectedOriginIds],
          changedByText: parsed.actor,
        });
      }

      const updatedForVersion = await tx.capa.findUniqueOrThrow({
        where: { id },
        include: {
          qmsRecord: {
            include: {
              targetRelations: {
                where: { isActive: true, relationType: "GENERATES" },
                include: { sourceRecord: true, auditFindingRelations: { where: { isActive: true }, include: { finding: { select: { id: true, reference: true } } } } },
              },
            },
          },
          plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          actionFollowups: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          followups: { orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }] },
          formVersion: true,
          annexIIITemplateVersion: true,
        },
      });
      const latestVersion = await tx.qmsRecordVersion.findFirst({
        where: { qmsRecordId: existing.qmsRecordId },
        orderBy: { sequenceNumber: "desc" },
      });
      const versionFollowupDate =
        v.saveIntent === "CREATE_FOLLOWUP_VERSION"
          ? toDate(v.versionFollowupDate)
          : latestVersion
            ? capaSnapshotVersionFollowupDate(
                latestVersion.snapshot,
                latestVersion.sequenceNumber,
              ) ?? (latestVersion.sequenceNumber === 0 ? updatedForVersion.openedAt : null)
            : updatedForVersion.openedAt;
      const versionSnapshot = snapshotJson(
        serializeCapaVersion(updatedForVersion, { versionFollowupDate }),
      );
      if (v.saveIntent === "CREATE_FOLLOWUP_VERSION") {
        await startNextVersion(
          tx,
          existing.qmsRecordId,
          RecordVersionKind.FOLLOWUP,
          versionSnapshot,
          parsed.actor,
          v.changeReason,
        );
      } else {
        await refreshCurrentVersion(
          tx,
          existing.qmsRecordId,
          versionSnapshot,
          parsed.actor,
          null,
        );
      }
    });

    revalidatePath("/capa");
    revalidatePath(`/capa/${id}`);
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

  redirect(qmsDetailUrl("/capa", id, formData.get("returnTo"), formData.get("detailTab")));
}

async function addCapaFollowupActionAuthenticatedContent(
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

async function addCapaRelationActionAuthenticatedContent(
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

    await prisma.$transaction(async (tx) => {
      await linkOperationalRelationByBusinessCode(tx, {
        currentRecordId: capa.qmsRecordId,
        currentType: QmsRecordType.CAPA,
        relatedType: requestedType,
        businessCode: code,
        createdByText: actor,
      });
      await refreshCapaVersionAfterRelationChange(tx, id, actor);
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


async function unlinkCapaOriginActionAuthenticatedContent(
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

  await prisma.$transaction(async (tx) => {
    await deactivateOperationalRelation(tx, {
      currentRecordId: capa.qmsRecordId,
      relatedRecordId: sourceQmsRecordId,
      changedByText: actor,
      reason: "Desvinculación de expediente de origen",
    });
    await refreshCapaVersionAfterRelationChange(tx, capaId, actor);
  });

  revalidatePath("/deviations");
  revalidatePath("/complaints");
  revalidatePath("/capa");
  revalidatePath(`/capa/${capaId}`);
}

export async function createCapaAction(...args: Parameters<typeof createCapaActionAuthenticatedContent>) {
  return authorizedAction("createCapaAction", args, authenticated => createCapaActionAuthenticatedContent(...authenticated as Parameters<typeof createCapaActionAuthenticatedContent>));
}

export async function updateCapaAction(...args: Parameters<typeof updateCapaActionAuthenticatedContent>) {
  return authorizedAction("updateCapaAction", args, authenticated => updateCapaActionAuthenticatedContent(...authenticated as Parameters<typeof updateCapaActionAuthenticatedContent>));
}

export async function addCapaFollowupAction(...args: Parameters<typeof addCapaFollowupActionAuthenticatedContent>) {
  return authorizedAction("addCapaFollowupAction", args, authenticated => addCapaFollowupActionAuthenticatedContent(...authenticated as Parameters<typeof addCapaFollowupActionAuthenticatedContent>));
}

export async function addCapaRelationAction(...args: Parameters<typeof addCapaRelationActionAuthenticatedContent>) {
  return authorizedAction("addCapaRelationAction", args, authenticated => addCapaRelationActionAuthenticatedContent(...authenticated as Parameters<typeof addCapaRelationActionAuthenticatedContent>));
}

export async function unlinkCapaOriginAction(...args: Parameters<typeof unlinkCapaOriginActionAuthenticatedContent>) {
  return authorizedAction("unlinkCapaOriginAction", args, authenticated => unlinkCapaOriginActionAuthenticatedContent(...authenticated as Parameters<typeof unlinkCapaOriginActionAuthenticatedContent>));
}
