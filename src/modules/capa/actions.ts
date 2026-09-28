"use server";

import { Prisma, QmsRecordType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { persistenceFormError } from "@/lib/forms/persistence-error";
import { parseCapaForm } from "@/modules/capa/validation";
import type { CapaFormState } from "@/modules/capa/types";
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

function recordTypeFromCode(code: string | null) {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (normalized.startsWith("D/")) return QmsRecordType.DEVIATION;
  if (normalized.startsWith("R/")) return QmsRecordType.COMPLAINT;
  if (normalized.startsWith("C/")) return QmsRecordType.CHANGE_CONTROL;
  if (normalized.startsWith("DEV/")) return QmsRecordType.RETURN;
  return null;
}

async function relatePrimaryOrigin(
  tx: Prisma.TransactionClient,
  capaRecordId: string,
  originCode: string | null,
  actor: string,
) {
  const recordType = recordTypeFromCode(originCode);
  if (!recordType || !originCode) return;
  const origin = await tx.qmsRecord.findUnique({
    where: { recordType_businessCode: { recordType, businessCode: originCode.trim() } },
  });
  if (!origin) return;
  await tx.qmsRelation.upsert({
    where: {
      sourceRecordId_targetRecordId_relationType: {
        sourceRecordId: origin.id,
        targetRecordId: capaRecordId,
        relationType: "GENERATES",
      },
    },
    update: { isActive: true, createdByText: actor },
    create: {
      sourceRecordId: origin.id,
      targetRecordId: capaRecordId,
      relationType: "GENERATES",
      createdByText: actor,
      notes: "Relación automática por código de origen CAPA.",
    },
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
          newValue: jsonValue(snapshot(v)),
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

      await relatePrimaryOrigin(tx, qmsRecord.id, v.originCode, parsed.actor);

      if (v.fromDeviationPlanId) {
        const plan = await tx.deviationCapaPlan.findUnique({
          where: { id: v.fromDeviationPlanId },
          include: { deviation: true },
        });
        if (plan) {
          await tx.deviationCapaPlan.update({
            where: { id: plan.id },
            data: {
              linkedCapaRecordId: qmsRecord.id,
              businessCapaCode: v.businessCode,
              proposalStatus: "REGISTERED",
            },
          });
          await tx.qmsRelation.upsert({
            where: {
              sourceRecordId_targetRecordId_relationType: {
                sourceRecordId: plan.deviation.qmsRecordId,
                targetRecordId: qmsRecord.id,
                relationType: "GENERATES",
              },
            },
            update: { isActive: true, createdByText: parsed.actor },
            create: {
              sourceRecordId: plan.deviation.qmsRecordId,
              targetRecordId: qmsRecord.id,
              relationType: "GENERATES",
              createdByText: parsed.actor,
              notes: "CAPA creada desde la propuesta registrada en la desviación.",
            },
          });
        }
      }
      if (v.fromComplaintId) {
        const complaint = await tx.complaint.findUnique({
          where: { id: v.fromComplaintId },
          select: { qmsRecordId: true },
        });
        if (complaint) {
          await tx.qmsRelation.upsert({
            where: {
              sourceRecordId_targetRecordId_relationType: {
                sourceRecordId: complaint.qmsRecordId,
                targetRecordId: qmsRecord.id,
                relationType: "GENERATES",
              },
            },
            update: { isActive: true, createdByText: parsed.actor },
            create: {
              sourceRecordId: complaint.qmsRecordId,
              targetRecordId: qmsRecord.id,
              relationType: "GENERATES",
              createdByText: parsed.actor,
              notes: "CAPA creada directamente desde una reclamación.",
            },
          });
        }
      }
      if (v.fromComplaintPlanId) {
        const plan = await tx.complaintCapaPlan.findUnique({
          where: { id: v.fromComplaintPlanId },
          include: { complaint: true },
        });
        if (plan) {
          await tx.complaintCapaPlan.update({
            where: { id: plan.id },
            data: {
              linkedCapaRecordId: qmsRecord.id,
              businessCapaCode: v.businessCode,
              proposalStatus: "REGISTERED",
            },
          });
          await tx.qmsRelation.upsert({
            where: {
              sourceRecordId_targetRecordId_relationType: {
                sourceRecordId: plan.complaint.qmsRecordId,
                targetRecordId: qmsRecord.id,
                relationType: "GENERATES",
              },
            },
            update: { isActive: true, createdByText: parsed.actor },
            create: {
              sourceRecordId: plan.complaint.qmsRecordId,
              targetRecordId: qmsRecord.id,
              relationType: "GENERATES",
              createdByText: parsed.actor,
              notes: "CAPA creada desde la propuesta registrada en la reclamación.",
            },
          });
        }
      }
      return created;
    });
    capaId = capa.id;
  } catch (error) {
    return persistenceFormError(error, "la CAPA");
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
    return { error: "No se puede guardar la CAPA.", fieldErrors: parsed.errors };
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
    return persistenceFormError(error, "la CAPA");
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

export async function addCapaRelationAction(id: string, formData: FormData) {
  const capa = await prisma.capa.findUnique({ where: { id }, include: { qmsRecord: true } });
  if (!capa) throw new Error("CAPA no encontrada.");

  const code = String(formData.get("relatedCode") ?? "").trim();
  const relationType = String(formData.get("relationType") ?? "RELATED_TO").trim();
  const actor = String(formData.get("createdByText") ?? "").trim() || "Usuario demo";
  if (!code) throw new Error("Debe indicarse la codificación del expediente relacionado.");

  const target = await prisma.qmsRecord.findFirst({
    where: {
      businessCode: code,
      id: { not: capa.qmsRecordId },
    },
  });
  if (!target) throw new Error("No existe un expediente QMS con esa codificación.");

  const allowed = ["GENERATES", "RELATED_TO", "IMPLEMENTED_BY", "ASSOCIATED_WITH"];
  const type = allowed.includes(relationType) ? relationType : "RELATED_TO";

  await prisma.qmsRelation.upsert({
    where: {
      sourceRecordId_targetRecordId_relationType: {
        sourceRecordId: capa.qmsRecordId,
        targetRecordId: target.id,
        relationType: type as "GENERATES" | "RELATED_TO" | "IMPLEMENTED_BY" | "ASSOCIATED_WITH",
      },
    },
    update: { isActive: true, createdByText: actor },
    create: {
      sourceRecordId: capa.qmsRecordId,
      targetRecordId: target.id,
      relationType: type as "GENERATES" | "RELATED_TO" | "IMPLEMENTED_BY" | "ASSOCIATED_WITH",
      createdByText: actor,
    },
  });

  revalidatePath(`/capa/${id}`);
}
