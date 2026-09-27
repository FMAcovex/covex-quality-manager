"use server";

import { ChangeScope, Prisma, QmsRecordType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseChangeControlForm } from "@/modules/change-control/validation";
import type { ChangeControlFormState } from "@/modules/change-control/types";
import {
  getApplicableFormVersion,
  getApplicableTemplateVersion,
} from "@/modules/configuration/runtime";
import {
  ensureInitialVersion,
  refreshCurrentVersion,
  serializeChangeControlVersion,
  snapshotJson,
  startNextVersion,
} from "@/lib/qms/versioning";

function toDate(value:string|null) {
  return value ? new Date(value) : null;
}
function jsonValue(value:unknown):Prisma.InputJsonValue {
  return {value:value===undefined?null:value} as Prisma.InputJsonValue;
}
function snapshot(values:ReturnType<typeof parseChangeControlForm>["values"]) {
  return {...values,changeReason:undefined};
}

async function versionRecord(tx:Prisma.TransactionClient,id:string) {
  return tx.changeControl.findUniqueOrThrow({
    where:{id},
    include:{
      qmsRecord:true,
      actions:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},
      followups:{orderBy:[{sequenceNumber:"asc"},{followupDate:"asc"}]},
      formVersion:true,
      requestDecisionTemplateVersion:true,
      followupTemplateVersion:true,
    },
  });
}

export async function createChangeControlAction(
  _previous:ChangeControlFormState,
  formData:FormData,
):Promise<ChangeControlFormState> {
  const parsed=parseChangeControlForm(formData);
  if(parsed.errors.length) return {error:"No se puede guardar el control de cambio.",fieldErrors:parsed.errors};
  const v=parsed.values;
  const department=await prisma.department.findUnique({where:{id:v.departmentId!}});
  if(!department) return {error:"El departamento seleccionado no existe."};

  const referenceDate=toDate(v.requestedAt)??new Date();
  const [formVersion,requestTemplate,followupTemplate]=await Promise.all([
    getApplicableFormVersion(QmsRecordType.CHANGE_CONTROL,referenceDate),
    getApplicableTemplateVersion(QmsRecordType.CHANGE_CONTROL,"CHANGE_ANNEX_III_IV",referenceDate),
    getApplicableTemplateVersion(QmsRecordType.CHANGE_CONTROL,"CHANGE_ANNEX_V",referenceDate),
  ]);

  try {
    const created=await prisma.$transaction(async(tx)=>{
      const qmsRecord=await tx.qmsRecord.create({
        data:{
          recordType:QmsRecordType.CHANGE_CONTROL,
          businessCode:v.businessCode,
          year:v.requestedAt?new Date(v.requestedAt).getFullYear():null,
        },
      });
      const row=await tx.changeControl.create({
        data:{
          qmsRecordId:qmsRecord.id,
          departmentId:department.id,
          departmentCodeSnapshot:department.code,
          departmentNameSnapshot:department.name,
          requestedAt:toDate(v.requestedAt),
          requesterName:v.requesterName,
          requesterPosition:v.requesterPosition,
          scopes:v.scopes as ChangeScope[],
          scopeOther:v.scopeOther,
          description:v.description,
          justification:v.justification,
          supportingDocuments:v.supportingDocuments,
          requestStatus:v.requestStatus,
          requestResponsible:v.requestResponsible,
          acceptedByText:v.acceptedByText,
          requestDecisionAt:toDate(v.requestDecisionAt),
          evaluation:v.evaluation,
          classification:v.classification,
          plannedImplementationAt:toDate(v.plannedImplementationAt),
          committeeRequired:v.committeeRequired,
          committeeJustification:v.committeeJustification,
          clientNotificationRequired:v.clientNotificationRequired,
          clientNotificationDetail:v.clientNotificationDetail,
          authorityNotificationRequired:v.authorityNotificationRequired,
          authorityNotificationDetail:v.authorityNotificationDetail,
          pqrRequirement:v.pqrRequirement,
          pqrProducts:v.pqrProducts,
          pqrPeriod:v.pqrPeriod,
          stabilityRequirement:v.stabilityRequirement,
          stabilityAccelerated:v.stabilityAccelerated,
          stabilityOngoing:v.stabilityOngoing,
          stabilityDetail:v.stabilityDetail,
          additionalAnalysis:v.additionalAnalysis,
          additionalAnalysisDetail:v.additionalAnalysisDetail,
          additionalValidation:v.additionalValidation,
          additionalValidationDetail:v.additionalValidationDetail,
          otherImplication:v.otherImplication,
          otherImplicationDetail:v.otherImplicationDetail,
          decisionResult:v.decisionResult,
          decisionAt:toDate(v.decisionAt),
          followupResponsible:v.followupResponsible,
          decisionObservations:v.decisionObservations,
          approvedByText:v.approvedByText,
          executionStatus:v.executionStatus,
          executedAt:toDate(v.executedAt),
          operationalClosedAt:toDate(v.operationalClosedAt),
          effectivenessStatus:v.effectivenessStatus,
          effectivenessObservations:v.effectivenessObservations,
          effectiveClosedAt:toDate(v.effectiveClosedAt),
          status:v.status,
          closeWithoutExecution:v.closeWithoutExecution,
          closureConclusion:v.closureConclusion,
          internalObservations:v.internalObservations,
          signedDocumentAvailable:v.signedDocumentAvailable,
          dataQualityStatus:v.dataQualityStatus,
          formVersionId:formVersion?.id,
          requestDecisionTemplateVersionId:requestTemplate?.id,
          followupTemplateVersionId:followupTemplate?.id,
          actions:{
            create:v.actions.map((item,index)=>({
              departmentText:item.departmentText||null,
              description:item.description,
              responsible:item.responsible||null,
              plannedExecutionDate:toDate(item.plannedExecutionDate),
              actualExecutionDate:toDate(item.actualExecutionDate),
              completed:item.completed,
              evidenceComment:item.evidenceComment||null,
              introducedInSequence:item.introducedInSequence??null,
              sortOrder:index,
            })),
          },
        },
      });
      await tx.changeHistory.create({
        data:{
          qmsRecordId:qmsRecord.id,
          changedByText:parsed.actor,
          fieldPath:"__created__",
          newValue:jsonValue(snapshot(v)),
          source:"UI",
        },
      });
      const full=await versionRecord(tx,row.id);
      await ensureInitialVersion(
        tx,
        qmsRecord.id,
        snapshotJson(serializeChangeControlVersion(full)),
        parsed.actor,
        "UI",
        "Solicitud y dictamen inicial del control de cambio",
      );
      return row;
    });
    revalidatePath("/changes");
    redirect(`/changes/${created.id}`);
  } catch(error) {
    if(error instanceof Error&&error.message.includes("Unique constraint")) {
      return {error:"Ya existe un control de cambio con esa codificación."};
    }
    throw error;
  }
}

export async function updateChangeControlAction(
  id:string,
  _previous:ChangeControlFormState,
  formData:FormData,
):Promise<ChangeControlFormState> {
  const existing=await prisma.changeControl.findUnique({
    where:{id},
    include:{
      qmsRecord:true,
      actions:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},
      followups:{orderBy:[{sequenceNumber:"asc"},{followupDate:"asc"}]},
      formVersion:true,
      requestDecisionTemplateVersion:true,
      followupTemplateVersion:true,
    },
  });
  if(!existing) return {error:"El control de cambio ya no existe."};
  const parsed=parseChangeControlForm(formData,{historical:existing.dataQualityStatus!=="COMPLETE"});
  if(parsed.errors.length) return {error:"No se puede guardar el control de cambio.",fieldErrors:parsed.errors};
  const v=parsed.values;
  const department=await prisma.department.findUnique({where:{id:v.departmentId!}});
  if(!department) return {error:"El departamento seleccionado no existe."};

  const oldSnapshot=serializeChangeControlVersion(existing);

  try {
    await prisma.$transaction(async(tx)=>{
      await tx.qmsRecord.update({
        where:{id:existing.qmsRecordId},
        data:{
          businessCode:v.businessCode,
          year:v.requestedAt?new Date(v.requestedAt).getFullYear():null,
        },
      });
      await tx.changeControl.update({
        where:{id},
        data:{
          departmentId:department.id,
          departmentCodeSnapshot:
            existing.departmentId===department.id
              ? existing.departmentCodeSnapshot??department.code
              : department.code,
          departmentNameSnapshot:
            existing.departmentId===department.id
              ? existing.departmentNameSnapshot??department.name
              : department.name,
          requestedAt:toDate(v.requestedAt),
          requesterName:v.requesterName,
          requesterPosition:v.requesterPosition,
          scopes:v.scopes as ChangeScope[],
          scopeOther:v.scopeOther,
          description:v.description,
          justification:v.justification,
          supportingDocuments:v.supportingDocuments,
          requestStatus:v.requestStatus,
          requestResponsible:v.requestResponsible,
          acceptedByText:v.acceptedByText,
          requestDecisionAt:toDate(v.requestDecisionAt),
          evaluation:v.evaluation,
          classification:v.classification,
          plannedImplementationAt:toDate(v.plannedImplementationAt),
          committeeRequired:v.committeeRequired,
          committeeJustification:v.committeeJustification,
          clientNotificationRequired:v.clientNotificationRequired,
          clientNotificationDetail:v.clientNotificationDetail,
          authorityNotificationRequired:v.authorityNotificationRequired,
          authorityNotificationDetail:v.authorityNotificationDetail,
          pqrRequirement:v.pqrRequirement,
          pqrProducts:v.pqrProducts,
          pqrPeriod:v.pqrPeriod,
          stabilityRequirement:v.stabilityRequirement,
          stabilityAccelerated:v.stabilityAccelerated,
          stabilityOngoing:v.stabilityOngoing,
          stabilityDetail:v.stabilityDetail,
          additionalAnalysis:v.additionalAnalysis,
          additionalAnalysisDetail:v.additionalAnalysisDetail,
          additionalValidation:v.additionalValidation,
          additionalValidationDetail:v.additionalValidationDetail,
          otherImplication:v.otherImplication,
          otherImplicationDetail:v.otherImplicationDetail,
          decisionResult:v.decisionResult,
          decisionAt:toDate(v.decisionAt),
          followupResponsible:v.followupResponsible,
          decisionObservations:v.decisionObservations,
          approvedByText:v.approvedByText,
          executionStatus:v.executionStatus,
          executedAt:toDate(v.executedAt),
          operationalClosedAt:toDate(v.operationalClosedAt),
          effectivenessStatus:v.effectivenessStatus,
          effectivenessObservations:v.effectivenessObservations,
          effectiveClosedAt:toDate(v.effectiveClosedAt),
          status:v.status,
          closeWithoutExecution:v.closeWithoutExecution,
          closureConclusion:v.closureConclusion,
          internalObservations:v.internalObservations,
          signedDocumentAvailable:v.signedDocumentAvailable,
          dataQualityStatus:v.dataQualityStatus,
          actions:{
            deleteMany:{},
            create:v.actions.map((item,index)=>({
              departmentText:item.departmentText||null,
              description:item.description,
              responsible:item.responsible||null,
              plannedExecutionDate:toDate(item.plannedExecutionDate),
              actualExecutionDate:toDate(item.actualExecutionDate),
              completed:item.completed,
              evidenceComment:item.evidenceComment||null,
              introducedInSequence:item.introducedInSequence??null,
              sortOrder:index,
            })),
          },
        },
      });
      const full=await versionRecord(tx,id);
      await refreshCurrentVersion(
        tx,
        existing.qmsRecordId,
        snapshotJson(serializeChangeControlVersion(full)),
        parsed.actor,
        v.changeReason,
      );
      await tx.changeHistory.create({
        data:{
          qmsRecordId:existing.qmsRecordId,
          changedByText:parsed.actor,
          fieldPath:"__record_update__",
          oldValue:snapshotJson(oldSnapshot),
          newValue:snapshotJson(serializeChangeControlVersion(full)),
          reason:v.changeReason,
          source:"UI",
        },
      });
    });
    revalidatePath("/changes");
    revalidatePath(`/changes/${id}`);
    redirect(`/changes/${id}`);
  } catch(error) {
    if(error instanceof Error&&error.message.includes("Unique constraint")) {
      return {error:"Ya existe un control de cambio con esa codificación."};
    }
    throw error;
  }
}

export async function addChangeControlFollowupAction(id:string,formData:FormData) {
  const change=await prisma.changeControl.findUnique({
    where:{id},
    include:{
      qmsRecord:true,
      actions:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},
      followups:{orderBy:[{sequenceNumber:"asc"},{followupDate:"asc"}]},
      formVersion:true,
      requestDecisionTemplateVersion:true,
      followupTemplateVersion:true,
    },
  });
  if(!change) throw new Error("Control de cambio no encontrado.");
  const date=String(formData.get("followupDate")??"").trim();
  const responsible=String(formData.get("responsibleText")??"").trim();
  const observations=String(formData.get("observations")??"").trim();
  const executionStatus=String(formData.get("executionStatus")??"NOT_EXECUTED");
  const executionDate=String(formData.get("executionDate")??"").trim();
  const effectivenessStatus=String(formData.get("effectivenessStatus")??"PENDING");
  const effectivenessObservations=String(formData.get("effectivenessObservations")??"").trim();
  const closesChange=formData.get("closesChange")==="on";
  const nextFollowupDate=String(formData.get("nextFollowupDate")??"").trim();
  const openReason=String(formData.get("openReason")??"").trim();
  const conclusion=String(formData.get("conclusion")??"").trim();
  const closedByText=String(formData.get("closedByText")??"").trim();
  const closureApprovedByText=String(formData.get("closureApprovedByText")??"").trim();
  if(!date||!responsible) throw new Error("Fecha y responsable del seguimiento son obligatorios.");
  if(!["EXECUTED","NOT_EXECUTED"].includes(executionStatus)) throw new Error("Estado de ejecución no válido.");
  if(!["PENDING","ACCEPTABLE","NOT_ACCEPTABLE"].includes(effectivenessStatus)) throw new Error("Estado de eficacia no válido.");
  if(executionStatus==="EXECUTED"&&!executionDate) throw new Error("Un cambio ejecutado requiere fecha de ejecución.");
  if(!closesChange&&(!nextFollowupDate||!openReason)) {
    throw new Error("Si el cambio sigue abierto, debe indicar motivo y próxima fecha de seguimiento.");
  }
  if(closesChange&&!conclusion) throw new Error("El cierre requiere motivo/conclusión.");
  if(closesChange&&executionStatus==="EXECUTED"&&effectivenessStatus!=="ACCEPTABLE") {
    throw new Error("Un cambio ejecutado solo puede cerrarse con eficacia Aceptable.");
  }

  const sequenceNumber=Math.max(-1,...change.followups.map((item)=>item.sequenceNumber))+1;
  await prisma.$transaction(async(tx)=>{
    const followup=await tx.changeControlFollowup.create({
      data:{
        changeControlId:id,
        sequenceNumber,
        followupDate:new Date(date),
        responsibleText:responsible,
        observations:observations||null,
        executionStatus:executionStatus as "EXECUTED"|"NOT_EXECUTED",
        executionDate:executionDate?new Date(executionDate):null,
        effectivenessStatus:effectivenessStatus as "PENDING"|"ACCEPTABLE"|"NOT_ACCEPTABLE",
        effectivenessObservations:effectivenessObservations||null,
        closesChange,
        nextFollowupDate:nextFollowupDate?new Date(nextFollowupDate):null,
        openReason:openReason||null,
        conclusion:conclusion||null,
        closedByText:closedByText||null,
        closureApprovedByText:closureApprovedByText||null,
      },
    });
    const closeWithoutExecution=closesChange&&executionStatus==="NOT_EXECUTED";
    await tx.changeControl.update({
      where:{id},
      data:{
        executionStatus:executionStatus as "EXECUTED"|"NOT_EXECUTED",
        executedAt:executionDate?new Date(executionDate):change.executedAt,
        operationalClosedAt:
          executionStatus==="EXECUTED"&&executionDate?new Date(executionDate):change.operationalClosedAt,
        effectivenessStatus:effectivenessStatus as "PENDING"|"ACCEPTABLE"|"NOT_ACCEPTABLE",
        effectivenessObservations:effectivenessObservations||change.effectivenessObservations,
        status:closesChange?"CLOSED":"OPEN",
        closeWithoutExecution:closesChange?closeWithoutExecution:change.closeWithoutExecution,
        effectiveClosedAt:closesChange?new Date(date):null,
        closureConclusion:closesChange?conclusion||null:change.closureConclusion,
      },
    });
    const full=await versionRecord(tx,id);
    await startNextVersion(
      tx,
      change.qmsRecordId,
      "FOLLOWUP",
      snapshotJson(serializeChangeControlVersion(full)),
      responsible,
      `Seguimiento ${String(sequenceNumber).padStart(2,"0")}`,
      followup.id,
      "UI",
    );
    await tx.changeHistory.create({
      data:{
        qmsRecordId:change.qmsRecordId,
        changedByText:responsible,
        fieldPath:`followups[${sequenceNumber}]`,
        newValue:jsonValue({
          followupDate:date,
          executionStatus,
          effectivenessStatus,
          closesChange,
          nextFollowupDate,
          openReason,
          conclusion,
        }),
        reason:"Nuevo seguimiento de control de cambio",
        source:"UI",
      },
    });
  });
  revalidatePath("/changes");
  revalidatePath(`/changes/${id}`);
}
