import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { persistenceFormError } from "@/lib/forms/persistence-error";
import { parseCapaFollowupTransition } from "@/modules/capa/followup-transition";
import { serializeCapaVersion, snapshotJson, startNextVersion } from "@/lib/qms/versioning";
import type { FollowupActionState } from "@/components/basic-followup-form";

function toDate(value: string | null) {
  return value ? new Date(value) : null;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return { value: value === undefined ? null : value } as Prisma.InputJsonValue;
}

export async function saveCapaFollowup(
  id: string,
  formData: FormData,
): Promise<FollowupActionState> {
  const capa = await prisma.capa.findUnique({
    where: { id },
    include: {
      qmsRecord: true,
      plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      actionFollowups: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: { orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }] },
      formVersion: true,
      annexIIITemplateVersion: true,
    },
  });
  if (!capa) return { error: "CAPA no encontrada." };
  if (capa.status === "DRAFT") {
    return { error: "La CAPA debe estar abierta antes de registrar seguimientos." };
  }

  const dateOnly = (value: Date | null) =>
    value ? value.toISOString().slice(0, 10) : null;

  const parsed = parseCapaFollowupTransition(formData, {
    current: {
      status: capa.status,
      operationalClosedAt: dateOnly(capa.operationalClosedAt),
      cancellationReason: capa.cancellationReason,
      conclusion: capa.conclusion,
      effectivenessStatus: capa.effectivenessStatus,
      effectivenessCriteria: capa.effectivenessCriteria,
      effectivenessAssessment: capa.effectivenessAssessment,
      effectivenessEvidence: capa.effectivenessEvidence,
      effectiveClosedAt: dateOnly(capa.effectiveClosedAt),
    },
    hasExistingExecutionEvidence: capa.followups.some((item) =>
      Boolean(item.evidenceReference?.trim()),
    ),
  });

  if (parsed.errors.length) {
    return { error: parsed.errors.join(" ") };
  }

  const v = parsed.values;
  const sequenceNumber =
    Math.max(0, ...capa.followups.map((item) => item.sequenceNumber)) + 1;

  const lifecycleBefore = {
    status: capa.status,
    operationalClosedAt: dateOnly(capa.operationalClosedAt),
    cancellationReason: capa.cancellationReason,
    conclusion: capa.conclusion,
    effectivenessStatus: capa.effectivenessStatus,
    effectivenessCriteria: capa.effectivenessCriteria,
    effectivenessAssessment: capa.effectivenessAssessment,
    effectivenessEvidence: capa.effectivenessEvidence,
    effectiveClosedAt: dateOnly(capa.effectiveClosedAt),
  };
  const lifecycleAfter = {
    status: v.status,
    operationalClosedAt: v.operationalClosedAt,
    cancellationReason: v.cancellationReason,
    conclusion: v.conclusion,
    effectivenessStatus: v.effectivenessStatus,
    effectivenessCriteria: v.effectivenessCriteria,
    effectivenessAssessment: v.effectivenessAssessment,
    effectivenessEvidence: v.effectivenessEvidence,
    effectiveClosedAt: v.effectiveClosedAt,
  };

  try {
    await prisma.$transaction(async (tx) => {
      const existingVersion = await tx.qmsRecordVersion.findFirst({
        where: { qmsRecordId: capa.qmsRecordId },
        orderBy: { sequenceNumber: "desc" },
      });
      if (!existingVersion) {
        const historicalSequence = Math.max(
          0,
          ...capa.followups.map((item) => item.sequenceNumber),
        );
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
            createdByText: v.completedByText,
            source: historicalSequence === 0 ? "UI" : "SYSTEM",
          },
        });
      }

      const followup = await tx.capaFollowup.create({
        data: {
          capaId: id,
          sequenceNumber,
          followupDate: new Date(v.followupDate),
          completedByText: v.completedByText,
          reason: v.reason,
          description: v.description,
          observations: v.observations,
          evidenceReference: v.evidenceReference,
          nextFollowupDate: toDate(v.nextFollowupDate),
        },
      });

      await tx.capa.update({
        where: { id },
        data: {
          status: v.status,
          nextFollowupDate: toDate(v.nextFollowupDate),
          operationalClosedAt: toDate(v.operationalClosedAt),
          cancellationReason: v.cancellationReason,
          conclusion: v.conclusion,
          effectivenessStatus: v.effectivenessStatus,
          effectivenessCriteria: v.effectivenessCriteria,
          effectivenessAssessment: v.effectivenessAssessment,
          effectivenessEvidence: v.effectivenessEvidence,
          effectiveClosedAt: toDate(v.effectiveClosedAt),
        },
      });

      await tx.changeHistory.create({
        data: {
          qmsRecordId: capa.qmsRecordId,
          changedByText: v.completedByText,
          fieldPath: `followups[${sequenceNumber}]`,
          newValue: jsonValue({
            followupDate: v.followupDate,
            reason: v.reason,
            description: v.description,
            observations: v.observations,
            evidenceReference: v.evidenceReference,
            nextFollowupDate: v.nextFollowupDate,
            status: v.status,
            operationalClosedAt: v.operationalClosedAt,
            effectivenessStatus: v.effectivenessStatus,
            effectiveClosedAt: v.effectiveClosedAt,
          }),
          reason: `Seguimiento CAPA ${String(sequenceNumber).padStart(2, "0")}`,
          source: "UI",
        },
      });

      for (const [fieldPath, newValue] of Object.entries(lifecycleAfter)) {
        const oldValue = lifecycleBefore[fieldPath as keyof typeof lifecycleBefore];
        if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
        await tx.changeHistory.create({
          data: {
            qmsRecordId: capa.qmsRecordId,
            changedByText: v.completedByText,
            fieldPath,
            oldValue: jsonValue(oldValue),
            newValue: jsonValue(newValue),
            reason: `Seguimiento CAPA ${String(sequenceNumber).padStart(2, "0")}`,
            source: "UI",
          },
        });
      }

      const updatedForVersion = await tx.capa.findUniqueOrThrow({
        where: { id },
        include: {
          qmsRecord: true,
          plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          actionFollowups: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
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
        v.completedByText,
        v.reason || `Seguimiento CAPA ${String(sequenceNumber).padStart(2, "0")}`,
        followup.id,
        "UI",
        sequenceNumber,
      );
    });
  } catch (error) {
    return persistenceFormError(error, "el seguimiento de la CAPA");
  }

  return {
    success: `Seguimiento ${String(sequenceNumber).padStart(2, "0")} guardado correctamente.`,
  };
}

