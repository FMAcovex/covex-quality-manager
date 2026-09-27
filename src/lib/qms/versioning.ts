import { HistorySource, Prisma, RecordVersionKind } from "@prisma/client";

type Tx = Prisma.TransactionClient;

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function versionLabel(sequenceNumber: number) {
  return `V${String(sequenceNumber).padStart(2, "0")}`;
}

export function snapshotJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function serializeDeviationVersion(record: any) {
  return {
    recordType: "DEVIATION",
    businessCode: record.qmsRecord?.businessCode ?? null,
    year: record.qmsRecord?.year ?? null,
    deviation: {
      departmentId: record.departmentId ?? null,
      departmentCodeSnapshot: record.departmentCodeSnapshot ?? null,
      departmentNameSnapshot: record.departmentNameSnapshot ?? null,
      issueDate: iso(record.issueDate),
      eventDateTime: iso(record.eventDateTime),
      detectedBy: record.detectedBy ?? null,
      createdByText: record.createdByText ?? null,
      materialProcessAffected: record.materialProcessAffected ?? null,
      provenance: record.provenance ?? null,
      deadlineStatus: record.deadlineStatus ?? null,
      formVersionId: record.formVersionId ?? null,
      formVersionCode: record.formVersion?.versionCode ?? null,
      anexoIIITemplateVersionId: record.anexoIIITemplateVersionId ?? null,
      anexoIIITemplateVersionCode: record.anexoIIITemplateVersion?.versionCode ?? null,
      processEquipmentSystem: record.processEquipmentSystem ?? null,
      finishedProductSystem: record.finishedProductSystem ?? null,
      productLot: record.productLot ?? null,
      lotSize: record.lotSize ?? null,
      affectedQuantity: record.affectedQuantity ?? null,
      client: record.client ?? null,
      rawOrPackagingMaterial: record.rawOrPackagingMaterial ?? null,
      materialLot: record.materialLot ?? null,
      materialLotSize: record.materialLotSize ?? null,
      materialAffectedQuantity: record.materialAffectedQuantity ?? null,
      supplier: record.supplier ?? null,
      supplierLot: record.supplierLot ?? null,
      affectedEquipmentLine: record.affectedEquipmentLine ?? null,
      otherOrigin: record.otherOrigin ?? null,
      affectedDocumentation: record.affectedDocumentation ?? null,
      whatHappened: record.whatHappened ?? null,
      whoInvolved: record.whoInvolved ?? null,
      whenHappened: record.whenHappened ?? null,
      whereHappened: record.whereHappened ?? null,
      howHappened: record.howHappened ?? null,
      investigation: record.investigation ?? null,
      investigationConclusive: record.investigationConclusive ?? null,
      investigationMethods: record.investigationMethods ?? [],
      rootCause: record.rootCause ?? null,
      recurrentRootCause: record.recurrentRootCause ?? null,
      recurrenceDetails: record.recurrenceDetails ?? null,
      classification: record.classification ?? null,
      validationImpact: record.validationImpact ?? null,
      registrationImpact: record.registrationImpact ?? null,
      stabilityImpact: record.stabilityImpact ?? null,
      otherProcessesImpact: record.otherProcessesImpact ?? null,
      otherProcessesImpactDetails: record.otherProcessesImpactDetails ?? null,
      affectsFinishedProduct: record.affectsFinishedProduct ?? null,
      capaRequired: record.capaRequired ?? null,
      conclusion: record.conclusion ?? null,
      disposition: record.disposition ?? null,
      dispositionQuantity: record.dispositionQuantity ?? null,
      dispositionComments: record.dispositionComments ?? null,
      clientNotification: record.clientNotification ?? null,
      closedAt: iso(record.closedAt),
      status: record.status ?? null,
      internalObservations: record.internalObservations ?? null,
      signedDocumentAvailable: record.signedDocumentAvailable ?? null,
      dataQualityStatus: record.dataQualityStatus ?? null,
      includeInKpi: record.includeInKpi ?? true,
      kpiExclusionReason: record.kpiExclusionReason ?? null,
      immediateActions: (record.immediateActions ?? []).map((item: any) => ({
        description: item.description,
        executedBy: item.executedBy ?? null,
        executedAt: iso(item.executedAt),
        sortOrder: item.sortOrder ?? 0,
      })),
      capaPlans: (record.capaPlans ?? []).map((item: any) => ({
        actionType: item.actionType,
        description: item.description,
        plannedExecutionDate: iso(item.plannedExecutionDate),
        responsible: item.responsible ?? null,
        businessCapaCode: item.businessCapaCode ?? null,
        linkedCapaRecordId: item.linkedCapaRecordId ?? null,
        linkedCapaBusinessCode: item.linkedCapaRecord?.businessCode ?? null,
        proposalStatus: item.proposalStatus ?? null,
      })),
      followups: (record.followups ?? []).map((item: any) => ({
        id: item.id,
        followupDate: iso(item.followupDate),
        completedByText: item.completedByText,
        followupType: item.followupType ?? null,
        comment: item.comment,
        nextFollowupDate: iso(item.nextFollowupDate),
        evidenceReference: item.evidenceReference ?? null,
      })),
    },
  };
}

export function serializeCapaVersion(record: any) {
  return {
    recordType: "CAPA",
    businessCode: record.qmsRecord?.businessCode ?? null,
    year: record.qmsRecord?.year ?? null,
    capa: {
      actionType: record.actionType,
      departmentId: record.departmentId ?? null,
      departmentCodeSnapshot: record.departmentCodeSnapshot ?? null,
      departmentNameSnapshot: record.departmentNameSnapshot ?? null,
      openedAt: iso(record.openedAt),
      createdByText: record.createdByText ?? null,
      originType: record.originType ?? null,
      originCode: record.originCode ?? null,
      applicableTo: record.applicableTo ?? null,
      defectDescription: record.defectDescription ?? null,
      rootCause: record.rootCause ?? null,
      impactAssessment: record.impactAssessment ?? null,
      operationalClosedAt: iso(record.operationalClosedAt),
      status: record.status,
      cancellationReason: record.cancellationReason ?? null,
      effectivenessStatus: record.effectivenessStatus,
      effectivenessCriteria: record.effectivenessCriteria ?? null,
      effectivenessAssessment: record.effectivenessAssessment ?? null,
      effectivenessEvidence: record.effectivenessEvidence ?? null,
      effectiveClosedAt: iso(record.effectiveClosedAt),
      conclusion: record.conclusion ?? null,
      internalObservations: record.internalObservations ?? null,
      signedDocumentAvailable: record.signedDocumentAvailable ?? null,
      dataQualityStatus: record.dataQualityStatus,
      includeInKpi: record.includeInKpi ?? true,
      kpiExclusionReason: record.kpiExclusionReason ?? null,
      formVersionId: record.formVersionId ?? null,
      formVersionCode: record.formVersion?.versionCode ?? null,
      anexoIIITemplateVersionId: record.annexIIITemplateVersionId ?? null,
      anexoIIITemplateVersionCode: record.annexIIITemplateVersion?.versionCode ?? null,
      plannedActions: (record.plannedActions ?? []).map((item: any) => ({
        description: item.description,
        responsible: item.responsible ?? null,
        plannedExecutionDate: iso(item.plannedExecutionDate),
        impact: item.impact ?? null,
        sortOrder: item.sortOrder ?? 0,
      })),
      followups: (record.followups ?? []).map((item: any) => ({
        id: item.id,
        sequenceNumber: item.sequenceNumber,
        followupDate: iso(item.followupDate),
        completedByText: item.completedByText,
        reason: item.reason ?? null,
        description: item.description,
        observations: item.observations ?? null,
        evidenceReference: item.evidenceReference ?? null,
        nextFollowupDate: iso(item.nextFollowupDate),
      })),
    },
  };
}

export async function ensureInitialVersion(
  tx: Tx,
  qmsRecordId: string,
  snapshot: Prisma.InputJsonValue,
  actor: string | null | undefined,
  source: HistorySource = "UI",
  reason = "Versión inicial del expediente",
) {
  return tx.qmsRecordVersion.upsert({
    where: { qmsRecordId_sequenceNumber: { qmsRecordId, sequenceNumber: 0 } },
    update: {},
    create: {
      qmsRecordId,
      sequenceNumber: 0,
      kind: RecordVersionKind.INITIAL,
      snapshot,
      reason,
      createdByText: actor ?? null,
      source,
    },
  });
}

export async function refreshCurrentVersion(
  tx: Tx,
  qmsRecordId: string,
  snapshot: Prisma.InputJsonValue,
  actor?: string | null,
  reason?: string | null,
) {
  const latest = await tx.qmsRecordVersion.findFirst({
    where: { qmsRecordId },
    orderBy: { sequenceNumber: "desc" },
  });
  if (!latest) {
    return ensureInitialVersion(tx, qmsRecordId, snapshot, actor, "SYSTEM", "Baseline creado al activar Hito 6.1");
  }
  if (latest.frozenAt) {
    return latest;
  }
  return tx.qmsRecordVersion.update({
    where: { id: latest.id },
    data: {
      snapshot,
      createdByText: actor ?? latest.createdByText,
      reason: reason ?? latest.reason,
    },
  });
}

export async function startNextVersion(
  tx: Tx,
  qmsRecordId: string,
  kind: RecordVersionKind,
  snapshot: Prisma.InputJsonValue,
  actor: string | null | undefined,
  reason: string | null | undefined,
  sourceEntityId?: string | null,
  source: HistorySource = "UI",
  sequenceNumberOverride?: number,
) {
  const latest = await tx.qmsRecordVersion.findFirst({
    where: { qmsRecordId },
    orderBy: { sequenceNumber: "desc" },
  });
  if (latest && !latest.frozenAt) {
    await tx.qmsRecordVersion.update({
      where: { id: latest.id },
      data: { frozenAt: new Date() },
    });
  }
  const sequenceNumber = sequenceNumberOverride ?? ((latest?.sequenceNumber ?? -1) + 1);
  if (latest && sequenceNumber <= latest.sequenceNumber) {
    throw new Error("La nueva versión debe ser posterior a la versión actual.");
  }
  return tx.qmsRecordVersion.create({
    data: {
      qmsRecordId,
      sequenceNumber,
      kind,
      snapshot,
      reason: reason ?? null,
      sourceEntityId: sourceEntityId ?? null,
      createdByText: actor ?? null,
      source,
    },
  });
}


function objectValue(value: Prisma.JsonValue): Record<string, any> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Snapshot de versión no válido.");
  }
  return value as Record<string, any>;
}

function dateValue(value: unknown) {
  return typeof value === "string" && value ? new Date(value) : null;
}

export function deviationSnapshotToAnnexRecord(snapshot: Prisma.JsonValue) {
  const root = objectValue(snapshot);
  const d = objectValue(root.deviation as Prisma.JsonValue);
  return {
    ...d,
    qmsRecord: { businessCode: root.businessCode ?? null },
    issueDate: dateValue(d.issueDate),
    eventDateTime: dateValue(d.eventDateTime),
    closedAt: dateValue(d.closedAt),
    immediateActions: (d.immediateActions ?? []).map((item: any) => ({
      ...item,
      executedAt: dateValue(item.executedAt),
    })),
    capaPlans: (d.capaPlans ?? []).map((item: any) => ({
      ...item,
      plannedExecutionDate: dateValue(item.plannedExecutionDate),
      linkedCapaRecord: item.linkedCapaBusinessCode
        ? { businessCode: item.linkedCapaBusinessCode }
        : null,
    })),
    anexoIIITemplateVersion: d.anexoIIITemplateVersionCode
      ? { versionCode: d.anexoIIITemplateVersionCode }
      : null,
  };
}

export function capaSnapshotToAnnexRecord(snapshot: Prisma.JsonValue) {
  const root = objectValue(snapshot);
  const d = objectValue(root.capa as Prisma.JsonValue);
  return {
    ...d,
    qmsRecord: { businessCode: root.businessCode ?? null },
    openedAt: dateValue(d.openedAt),
    operationalClosedAt: dateValue(d.operationalClosedAt),
    effectiveClosedAt: dateValue(d.effectiveClosedAt),
    plannedActions: (d.plannedActions ?? []).map((item: any) => ({
      ...item,
      plannedExecutionDate: dateValue(item.plannedExecutionDate),
    })),
    followups: (d.followups ?? []).map((item: any) => ({
      ...item,
      followupDate: dateValue(item.followupDate),
      nextFollowupDate: dateValue(item.nextFollowupDate),
    })),
    annexIIITemplateVersion: d.anexoIIITemplateVersionCode
      ? { versionCode: d.anexoIIITemplateVersionCode }
      : null,
  };
}

export function recordVersionSummary(
  recordType: "DEVIATION" | "CAPA",
  snapshot: Prisma.JsonValue,
) {
  const root = objectValue(snapshot);
  if (recordType === "DEVIATION") {
    const d = objectValue(root.deviation as Prisma.JsonValue);
    return {
      status: d.status ?? null,
      closedAt: d.closedAt ?? null,
      effectivenessStatus: null,
      effectiveClosedAt: null,
      nextFollowupDate: null,
    };
  }
  const d = objectValue(root.capa as Prisma.JsonValue);
  const followups = Array.isArray(d.followups) ? d.followups : [];
  const latest = followups.length ? followups[followups.length - 1] : null;
  return {
    status: d.status ?? null,
    closedAt: d.operationalClosedAt ?? null,
    effectivenessStatus: d.effectivenessStatus ?? null,
    effectiveClosedAt: d.effectiveClosedAt ?? null,
    nextFollowupDate: latest?.nextFollowupDate ?? null,
  };
}
