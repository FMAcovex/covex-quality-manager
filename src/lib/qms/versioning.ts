import { HistorySource, Prisma, RecordVersionKind } from "@prisma/client";

type Tx = Prisma.TransactionClient;

type DeviationVersionSource = Prisma.DeviationGetPayload<{
  include: {
    qmsRecord: true;
    immediateActions: true;
    followups: true;
    capaPlans: { include: { linkedCapaRecord: true } };
    derivedActions: true;
    formVersion: true;
    anexoIIITemplateVersion: true;
  };
}>;

type CapaVersionSource = Prisma.CapaGetPayload<{
  include: {
    qmsRecord: true;
    plannedActions: true;
    followups: true;
    formVersion: true;
    annexIIITemplateVersion: true;
  };
}>;

type ComplaintVersionSource = Prisma.ComplaintGetPayload<{
  include: {
    qmsRecord: true;
    followups: true;
    capaPlans: { include: { linkedCapaRecord: true } };
    formVersion: true;
    annexIIITemplateVersion: true;
    annexIVTemplateVersion: true;
    annexVTemplateVersion: true;
  };
}>;

type ReturnVersionSource = Prisma.ReturnRecordGetPayload<{
  include: {
    qmsRecord: true;
    products: true;
    followups: true;
    formVersion: true;
    annexIIITemplateVersion: true;
    annexIVTemplateVersion: true;
    annexVTemplateVersion: true;
    annexVITemplateVersion: true;
  };
}>;

type ChangeControlVersionSource = Prisma.ChangeControlGetPayload<{
  include: {
    qmsRecord: true;
    tasks: true;
    followups: { include: { taskStates: true } };
    formVersion: true;
    annexIIITemplateVersion: true;
    annexIVTemplateVersion: true;
    annexVTemplateVersion: true;
  };
}>;

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function versionLabel(sequenceNumber: number) {
  return `V${String(sequenceNumber).padStart(2, "0")}`;
}

export function snapshotJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function serializeDeviationVersion(record: DeviationVersionSource) {
  return {
    recordType: "DEVIATION",
    businessCode: record.qmsRecord.businessCode ?? null,
    year: record.qmsRecord.year ?? null,
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
      includeInKpi: record.includeInKpi,
      kpiExclusionReason: record.kpiExclusionReason ?? null,
      immediateActions: record.immediateActions.map((item) => ({
        description: item.description,
        executedBy: item.executedBy ?? null,
        executedAt: iso(item.executedAt),
        sortOrder: item.sortOrder,
      })),
      capaPlans: record.capaPlans.map((item) => ({
        actionType: item.actionType,
        description: item.description,
        plannedExecutionDate: iso(item.plannedExecutionDate),
        responsible: item.responsible ?? null,
        businessCapaCode: item.businessCapaCode ?? null,
        linkedCapaRecordId: item.linkedCapaRecordId ?? null,
        linkedCapaBusinessCode: item.linkedCapaRecord?.businessCode ?? null,
        proposalStatus: item.proposalStatus,
      })),
      followups: record.followups.map((item) => ({
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

export function serializeCapaVersion(record: CapaVersionSource) {
  return {
    recordType: "CAPA",
    businessCode: record.qmsRecord.businessCode ?? null,
    year: record.qmsRecord.year ?? null,
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
      includeInKpi: record.includeInKpi,
      kpiExclusionReason: record.kpiExclusionReason ?? null,
      formVersionId: record.formVersionId ?? null,
      formVersionCode: record.formVersion?.versionCode ?? null,
      anexoIIITemplateVersionId: record.annexIIITemplateVersionId ?? null,
      anexoIIITemplateVersionCode: record.annexIIITemplateVersion?.versionCode ?? null,
      plannedActions: record.plannedActions.map((item) => ({
        description: item.description,
        responsible: item.responsible ?? null,
        plannedExecutionDate: iso(item.plannedExecutionDate),
        impact: item.impact ?? null,
        sortOrder: item.sortOrder,
      })),
      followups: record.followups.map((item) => ({
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

export function serializeChangeControlVersion(record: ChangeControlVersionSource) {
  return {
    recordType: "CHANGE_CONTROL",
    businessCode: record.qmsRecord.businessCode ?? null,
    year: record.qmsRecord.year ?? null,
    changeControl: {
      departmentId: record.departmentId ?? null,
      departmentCodeSnapshot: record.departmentCodeSnapshot ?? null,
      departmentNameSnapshot: record.departmentNameSnapshot ?? null,
      requestDate: iso(record.requestDate),
      requesterName: record.requesterName ?? null,
      requesterPosition: record.requesterPosition ?? null,
      scope: record.scope,
      otherScope: record.otherScope ?? null,
      description: record.description ?? null,
      justification: record.justification ?? null,
      providedDocuments: record.providedDocuments ?? null,
      requestDecision: record.requestDecision,
      requestDecisionResponsible: record.requestDecisionResponsible ?? null,
      requestDecisionRole: record.requestDecisionRole ?? null,
      requestDecisionDate: iso(record.requestDecisionDate),
      evaluation: record.evaluation ?? null,
      classification: record.classification ?? null,
      plannedImplementationDate: iso(record.plannedImplementationDate),
      committeeRequired: record.committeeRequired ?? null,
      committeeDetails: record.committeeDetails ?? null,
      clientNotificationRequired: record.clientNotificationRequired ?? null,
      clientNotificationDetails: record.clientNotificationDetails ?? null,
      authorityRequired: record.authorityRequired ?? null,
      authorityDetails: record.authorityDetails ?? null,
      pqrRequired: record.pqrRequired ?? null,
      pqrProducts: record.pqrProducts ?? null,
      pqrPeriod: record.pqrPeriod ?? null,
      stabilityRequired: record.stabilityRequired ?? null,
      stabilityAccelerated: record.stabilityAccelerated,
      stabilityOngoing: record.stabilityOngoing,
      additionalAnalysisRequired: record.additionalAnalysisRequired ?? null,
      additionalAnalysisDetails: record.additionalAnalysisDetails ?? null,
      additionalValidationRequired: record.additionalValidationRequired ?? null,
      additionalValidationDetails: record.additionalValidationDetails ?? null,
      otherImplicationRequired: record.otherImplicationRequired ?? null,
      otherImplicationDetails: record.otherImplicationDetails ?? null,
      dictamenResult: record.dictamenResult,
      dictamenDate: iso(record.dictamenDate),
      followupResponsible: record.followupResponsible ?? null,
      dictamenObservations: record.dictamenObservations ?? null,
      approvalNames: record.approvalNames ?? null,
      executionStatus: record.executionStatus,
      executionDate: iso(record.executionDate),
      operationalClosedAt: iso(record.operationalClosedAt),
      effectivenessStatus: record.effectivenessStatus,
      effectiveClosedAt: iso(record.effectiveClosedAt),
      finalStatus: record.finalStatus,
      closureConclusion: record.closureConclusion ?? null,
      internalObservations: record.internalObservations ?? null,
      signedDocumentAvailable: record.signedDocumentAvailable ?? null,
      dataQualityStatus: record.dataQualityStatus,
      includeInKpi: record.includeInKpi,
      kpiExclusionReason: record.kpiExclusionReason ?? null,
      formVersionId: record.formVersionId ?? null,
      formVersionCode: record.formVersion?.versionCode ?? null,
      annexIIITemplateVersionId: record.annexIIITemplateVersionId ?? null,
      annexIIITemplateVersionCode: record.annexIIITemplateVersion?.versionCode ?? null,
      annexIVTemplateVersionId: record.annexIVTemplateVersionId ?? null,
      annexIVTemplateVersionCode: record.annexIVTemplateVersion?.versionCode ?? null,
      annexVTemplateVersionId: record.annexVTemplateVersionId ?? null,
      annexVTemplateVersionCode: record.annexVTemplateVersion?.versionCode ?? null,
      tasks: record.tasks.map((item) => ({
        id: item.id,
        departmentId: item.departmentId ?? null,
        departmentCodeSnapshot: item.departmentCodeSnapshot ?? null,
        departmentNameSnapshot: item.departmentNameSnapshot ?? null,
        description: item.description,
        responsible: item.responsible ?? null,
        plannedDate: iso(item.plannedDate),
        origin: item.origin,
        introducedInFollowup: item.introducedInFollowup ?? null,
        sortOrder: item.sortOrder,
      })),
      followups: record.followups.map((item) => ({
        id: item.id,
        sequenceNumber: item.sequenceNumber,
        followupDate: iso(item.followupDate),
        responsible: item.responsible,
        observations: item.observations ?? null,
        executionStatus: item.executionStatus,
        executionDate: iso(item.executionDate),
        effectivenessStatus: item.effectivenessStatus,
        effectivenessObservations: item.effectivenessObservations ?? null,
        closeChange: item.closeChange,
        nextFollowupDate: iso(item.nextFollowupDate),
        remainOpenReason: item.remainOpenReason ?? null,
        conclusion: item.conclusion ?? null,
        approvalByText: item.approvalByText ?? null,
        taskStates: item.taskStates.map((state) => ({
          taskId: state.taskId,
          status: state.status,
          actualDate: iso(state.actualDate),
          evidenceComment: state.evidenceComment ?? null,
        })),
      })),
    },
  };
}

export function serializeComplaintVersion(record: ComplaintVersionSource) {
  return {
    recordType: "COMPLAINT",
    businessCode: record.qmsRecord.businessCode ?? null,
    year: record.qmsRecord.year ?? null,
    complaint: {
      departmentId: record.departmentId ?? null,
      departmentCodeSnapshot: record.departmentCodeSnapshot ?? null,
      departmentNameSnapshot: record.departmentNameSnapshot ?? null,
      openedAt: iso(record.openedAt), detectionDate: iso(record.detectionDate), receptionDate: iso(record.receptionDate),
      detectedBy: record.detectedBy ?? null, createdByText: record.createdByText ?? null,
      complaintType: record.complaintType, sourceTypes: record.sourceTypes ?? [], sourceOther: record.sourceOther ?? null,
      scopeTypes: record.scopeTypes ?? [], scopeOther: record.scopeOther ?? null,
      affectedObjectTypes: record.affectedObjectTypes ?? [], affectedObjectOther: record.affectedObjectOther ?? null,
      categoryTypes: record.categoryTypes ?? [], categoryOther: record.categoryOther ?? null,
      partyName: record.partyName ?? null, contact: record.contact ?? null,
      affectedScope: record.affectedScope ?? null, reference: record.reference ?? null, lotReference: record.lotReference ?? null,
      quantity: record.quantity ?? null, expiryReanalysis: record.expiryReanalysis ?? null,
      purchaseDeliveryReference: record.purchaseDeliveryReference ?? null, description: record.description ?? null,
      recurrent: record.recurrent ?? null, recurrenceReference: record.recurrenceReference ?? null,
      attachedDocumentation: record.attachedDocumentation ?? null, emittedBy: record.emittedBy ?? null,
      qaValidatedBy: record.qaValidatedBy ?? null, investigation: record.investigation ?? null,
      impactAssessment: record.impactAssessment ?? null, impactQualityGmp: record.impactQualityGmp ?? null,
      impactSafetyEfficacy: record.impactSafetyEfficacy ?? null, impactRegulatory: record.impactRegulatory ?? null,
      impactEnvironment: record.impactEnvironment ?? null, impactOtherSimilar: record.impactOtherSimilar ?? null,
      containmentActions: record.containmentActions ?? [], containmentOther: record.containmentOther ?? null,
      riskJustification: record.riskJustification ?? null, investigationResult: record.investigationResult ?? null,
      rootCause: record.rootCause ?? null, classification: record.classification ?? null,
      potentialRecall: record.potentialRecall ?? null, recallProcedureRequired: record.recallProcedureRequired ?? null,
      authorityNotificationRequired: record.authorityNotificationRequired ?? null,
      responsiblePartyCommunicationRequired: record.responsiblePartyCommunicationRequired ?? null,
      regulatoryJustification: record.regulatoryJustification ?? null,
      resolutionLines: record.resolutionLines ?? null, resolutionActions: record.resolutionActions,
      immediateActionDetails: record.immediateActionDetails ?? null, otherResolutionDetails: record.otherResolutionDetails ?? null,
      externalCommunication: record.externalCommunication ?? null, communicationDate: iso(record.communicationDate),
      communicationMedium: record.communicationMedium ?? null, communicationParties: record.communicationParties ?? null,
      communicationSummary: record.communicationSummary ?? null, partIIRequired: record.partIIRequired ?? null,
      conclusion: record.conclusion ?? null, effectivenessRequired: record.effectivenessRequired ?? null, initialEvaluationDate: iso(record.initialEvaluationDate),
      initialConclusionDate: iso(record.initialConclusionDate), responseDate: iso(record.responseDate),
      responseMedium: record.responseMedium ?? null, responseSummary: record.responseSummary ?? null,
      responseSufficient: record.responseSufficient ?? null, effectivenessStatus: record.effectivenessStatus,
      effectivenessAssessment: record.effectivenessAssessment ?? null, closeActionStatus: record.closeActionStatus ?? null,
      closeActionReferences: record.closeActionReferences ?? null, closeConclusion: record.closeConclusion ?? null, approvalNames: record.approvalNames ?? null,
      closeApprovalNames: record.closeApprovalNames ?? null, closedAt: iso(record.closedAt), status: record.status,
      internalObservations: record.internalObservations ?? null, signedDocumentAvailable: record.signedDocumentAvailable ?? null,
      dataQualityStatus: record.dataQualityStatus, includeInKpi: record.includeInKpi, kpiExclusionReason: record.kpiExclusionReason ?? null,
      formVersionId: record.formVersionId ?? null, formVersionCode: record.formVersion?.versionCode ?? null,
      annexIIITemplateVersionId: record.annexIIITemplateVersionId ?? null, annexIIITemplateVersionCode: record.annexIIITemplateVersion?.versionCode ?? null,
      annexIVTemplateVersionId: record.annexIVTemplateVersionId ?? null, annexIVTemplateVersionCode: record.annexIVTemplateVersion?.versionCode ?? null,
      annexVTemplateVersionId: record.annexVTemplateVersionId ?? null, annexVTemplateVersionCode: record.annexVTemplateVersion?.versionCode ?? null,
      capaPlans: record.capaPlans.map(x=>({actionType:x.actionType,description:x.description,plannedExecutionDate:iso(x.plannedExecutionDate),responsible:x.responsible??null,businessCapaCode:x.businessCapaCode??null,linkedCapaRecordId:x.linkedCapaRecordId??null,linkedCapaBusinessCode:x.linkedCapaRecord?.businessCode??null,proposalStatus:x.proposalStatus})),
      derivedActions: record.derivedActions.map(x=>({actionType:x.actionType,businessCode:x.businessCode??null,description:x.description??null,responsible:x.responsible??null,plannedExecutionDate:iso(x.plannedExecutionDate),sortOrder:x.sortOrder})),
      followups: record.followups.map(x=>({id:x.id,followupDate:iso(x.followupDate),completedByText:x.completedByText,followupType:x.followupType??null,comment:x.comment,nextFollowupDate:iso(x.nextFollowupDate),evidenceReference:x.evidenceReference??null}))
    }
  };
}

export function serializeReturnVersion(record: ReturnVersionSource) {
  return {
    recordType: "RETURN",
    businessCode: record.qmsRecord.businessCode ?? null,
    year: record.qmsRecord.year ?? null,
    returnRecord: {
      departmentId: record.departmentId ?? null, departmentCodeSnapshot: record.departmentCodeSnapshot ?? null,
      departmentNameSnapshot: record.departmentNameSnapshot ?? null, communicationDate: iso(record.communicationDate),
      receivedAt: iso(record.receivedAt), createdByText: record.createdByText ?? null, returnType: record.returnType,
      otherReturnType: record.otherReturnType ?? null, customerEntity: record.customerEntity ?? null, country: record.country ?? null,
      address: record.address ?? null, relatedDocument: record.relatedDocument ?? null, conservationConditions: record.conservationConditions ?? null,
      deliveryNote: record.deliveryNote ?? null, reasonObservations: record.reasonObservations ?? null, attachedDocumentation: record.attachedDocumentation ?? null,
      withinAcceptedReturnPeriod: record.withinAcceptedReturnPeriod ?? null, roomTemperatureWithinTenDays: record.roomTemperatureWithinTenDays ?? null,
      coldChainWithinFortyEightHours: record.coldChainWithinFortyEightHours ?? null, uniqueIdentifierActive: record.uniqueIdentifierActive ?? null,
      tamperEvidenceIntact: record.tamperEvidenceIntact ?? null, packagingIntegrityOk: record.packagingIntegrityOk ?? null,
      customerDeclarationAvailable: record.customerDeclarationAvailable ?? null,
      customerDeclarationSignatoryName: record.customerDeclarationSignatoryName ?? null,
      customerDeclarationSignatoryRole: record.customerDeclarationSignatoryRole ?? null,
      customerDeclarationSignedAt: iso(record.customerDeclarationSignedAt),
      customerDeclarationObservations: record.customerDeclarationObservations ?? null,
      storageTransportConditionsOk: record.storageTransportConditionsOk ?? null,
      noUseDamageContamination: record.noUseDamageContamination ?? null, noRecallAlertBlock: record.noRecallAlertBlock ?? null,
      expiryAcceptable: record.expiryAcceptable ?? null, qcAssessmentCompleted: record.qcAssessmentCompleted ?? null,
      storageTemperatureRecord: record.storageTemperatureRecord ?? null, returnTransportTempEvidence: record.returnTransportTempEvidence ?? null,
      transportPackagingSuitable: record.transportPackagingSuitable ?? null, receiptTemperatureAcceptable: record.receiptTemperatureAcceptable ?? null,
      temperatureExcursionEvaluated: record.temperatureExcursionEvaluated ?? null, coldChainReturnSystemValidated: record.coldChainReturnSystemValidated ?? null,
      decision: record.decision, finalDestination: record.finalDestination ?? null, decisionObservations: record.decisionObservations ?? null,
      qaApprovalName: record.qaApprovalName ?? null, technicalApprovalName: record.technicalApprovalName ?? null, decisionDate: iso(record.decisionDate),
      destructionManagedBy: record.destructionManagedBy ?? null, destructionCertificate: record.destructionCertificate ?? null,
      traceabilityUpdated: record.traceabilityUpdated ?? null, closedAt: iso(record.closedAt), status: record.status,
      internalObservations: record.internalObservations ?? null, signedDocumentAvailable: record.signedDocumentAvailable ?? null,
      dataQualityStatus: record.dataQualityStatus, includeInKpi: record.includeInKpi, kpiExclusionReason: record.kpiExclusionReason ?? null,
      formVersionId: record.formVersionId ?? null, formVersionCode: record.formVersion?.versionCode ?? null,
      products: record.products.map(x=>({departmentId:x.departmentId??null,productType:x.productType,otherProductType:x.otherProductType??null,productNameCode:x.productNameCode,format:x.format??null,lot:x.lot??null,expiryReanalysis:x.expiryReanalysis??null,quantity:x.quantity??null,unit:x.unit??null,netWeight:x.netWeight??null,grossWeight:x.grossWeight??null,receptionObservations:x.receptionObservations??null,receivedBy:x.receivedBy??null,receivedByDate:iso(x.receivedByDate),verifiedBy:x.verifiedBy??null,verifiedByDate:iso(x.verifiedByDate),sortOrder:x.sortOrder})),
      followups: record.followups.map(x=>({id:x.id,followupDate:iso(x.followupDate),completedByText:x.completedByText,comment:x.comment,nextFollowupDate:iso(x.nextFollowupDate),evidenceReference:x.evidenceReference??null}))
    }
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
    return ensureInitialVersion(
      tx,
      qmsRecordId,
      snapshot,
      actor,
      "SYSTEM",
      "Baseline creado al activar Hito 6.1",
    );
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

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Snapshot de versión no válido.");
  }
  return value as Record<string, unknown>;
}

function objectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.map((item) => objectValue(item));
}

function dateValue(value: unknown) {
  return typeof value === "string" && value ? new Date(value) : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

export function deviationSnapshotToAnnexRecord(snapshot: Prisma.JsonValue) {
  const root = objectValue(snapshot);
  const d = objectValue(root.deviation);
  return {
    ...d,
    qmsRecord: { businessCode: root.businessCode ?? null },
    issueDate: dateValue(d.issueDate),
    eventDateTime: dateValue(d.eventDateTime),
    closedAt: dateValue(d.closedAt),
    immediateActions: objectArray(d.immediateActions).map((item) => ({
      ...item,
      executedAt: dateValue(item.executedAt),
    })),
    capaPlans: objectArray(d.capaPlans).map((item) => ({
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
  const d = objectValue(root.capa);
  return {
    ...d,
    qmsRecord: { businessCode: root.businessCode ?? null },
    openedAt: dateValue(d.openedAt),
    operationalClosedAt: dateValue(d.operationalClosedAt),
    effectiveClosedAt: dateValue(d.effectiveClosedAt),
    plannedActions: objectArray(d.plannedActions).map((item) => ({
      ...item,
      plannedExecutionDate: dateValue(item.plannedExecutionDate),
    })),
    followups: objectArray(d.followups)
      .map((item) => ({
        ...item,
        sequenceNumber: Number(item.sequenceNumber ?? 0),
        followupDate: dateValue(item.followupDate),
        nextFollowupDate: dateValue(item.nextFollowupDate),
      }))
      .sort(
        (a, b) =>
          Number(b.sequenceNumber ?? 0) - Number(a.sequenceNumber ?? 0),
      ),
    annexIIITemplateVersion: d.anexoIIITemplateVersionCode
      ? { versionCode: d.anexoIIITemplateVersionCode }
      : null,
  };
}

export function recordVersionSummary(
  recordType: "DEVIATION" | "CAPA" | "CHANGE_CONTROL",
  snapshot: Prisma.JsonValue,
) {
  const root = objectValue(snapshot);
  if (recordType === "DEVIATION") {
    const d = objectValue(root.deviation);
    return {
      status: stringValue(d.status),
      closedAt: stringValue(d.closedAt),
      effectivenessStatus: null,
      effectiveClosedAt: null,
      nextFollowupDate: null,
    };
  }
  if (recordType === "CAPA") {
    const d = objectValue(root.capa);
    const followups = objectArray(d.followups);
    const latest = followups.at(-1) ?? null;
    return {
      status: stringValue(d.status),
      closedAt: stringValue(d.operationalClosedAt),
      effectivenessStatus: stringValue(d.effectivenessStatus),
      effectiveClosedAt: stringValue(d.effectiveClosedAt),
      nextFollowupDate: stringValue(latest?.nextFollowupDate),
    };
  }
  const d = objectValue(root.changeControl);
  const followups = objectArray(d.followups);
  const latest = followups.at(-1) ?? null;
  return {
    status: stringValue(d.finalStatus),
    closedAt: stringValue(d.operationalClosedAt),
    effectivenessStatus: stringValue(d.effectivenessStatus),
    effectiveClosedAt: stringValue(d.effectiveClosedAt),
    nextFollowupDate: stringValue(latest?.nextFollowupDate),
  };
}



export function changeControlSnapshotToRecord(snapshot: Prisma.JsonValue) {
  const root = objectValue(snapshot);
  const d = objectValue(root.changeControl);
  return {
    ...d,
    qmsRecord: { businessCode: stringValue(root.businessCode) },
    requestDate: dateValue(d.requestDate),
    requestDecisionDate: dateValue(d.requestDecisionDate),
    plannedImplementationDate: dateValue(d.plannedImplementationDate),
    dictamenDate: dateValue(d.dictamenDate),
    executionDate: dateValue(d.executionDate),
    operationalClosedAt: dateValue(d.operationalClosedAt),
    effectiveClosedAt: dateValue(d.effectiveClosedAt),
    tasks: objectArray(d.tasks).map((item) => ({
      ...item,
      id: stringValue(item.id) ?? "",
      plannedDate: dateValue(item.plannedDate),
      introducedInFollowup:
        typeof item.introducedInFollowup === "number" ? item.introducedInFollowup : null,
    })),
    followups: objectArray(d.followups).map((item) => ({
      ...item,
      id: stringValue(item.id) ?? "",
      sequenceNumber: Number(item.sequenceNumber ?? 0),
      followupDate: dateValue(item.followupDate),
      executionDate: dateValue(item.executionDate),
      nextFollowupDate: dateValue(item.nextFollowupDate),
      taskStates: objectArray(item.taskStates).map((state) => ({
        ...state,
        taskId: stringValue(state.taskId) ?? "",
        actualDate: dateValue(state.actualDate),
      })),
    })),
    formVersion: d.formVersionCode ? { versionCode: stringValue(d.formVersionCode) ?? "" } : null,
    annexIIITemplateVersion: d.annexIIITemplateVersionCode
      ? { versionCode: stringValue(d.annexIIITemplateVersionCode) ?? "" }
      : null,
    annexIVTemplateVersion: d.annexIVTemplateVersionCode
      ? { versionCode: stringValue(d.annexIVTemplateVersionCode) ?? "" }
      : null,
    annexVTemplateVersion: d.annexVTemplateVersionCode
      ? { versionCode: stringValue(d.annexVTemplateVersionCode) ?? "" }
      : null,
  };
}

export function changeControlSnapshotTemplateId(
  snapshot: Prisma.JsonValue,
  annex: "III" | "IV" | "V",
) {
  const root = objectValue(snapshot);
  const d = objectValue(root.changeControl);
  const key =
    annex === "III"
      ? "annexIIITemplateVersionId"
      : annex === "IV"
        ? "annexIVTemplateVersionId"
        : "annexVTemplateVersionId";
  return stringValue(d[key]);
}

export function recordVersionTemplateId(
  recordType: "DEVIATION" | "CAPA",
  snapshot: Prisma.JsonValue,
) {
  const root = objectValue(snapshot);
  const section = objectValue(
    recordType === "DEVIATION" ? root.deviation : root.capa,
  );
  const value =
    recordType === "DEVIATION"
      ? section.anexoIIITemplateVersionId
      : section.anexoIIITemplateVersionId;
  return typeof value === "string" ? value : null;
}
