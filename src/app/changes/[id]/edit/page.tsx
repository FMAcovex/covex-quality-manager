import { notFound } from "next/navigation";
import { updateChangeControlAction } from "@/modules/change-control/actions";
import { ChangeControlForm } from "@/modules/change-control/components/change-control-form";
import { getChangeControlDetail,getChangeControlLookups } from "@/modules/change-control/queries";
import type { ChangeControlFormDefaults } from "@/modules/change-control/types";

export const dynamic="force-dynamic";
const b=(v:boolean|null):""|"true"|"false"=>v===true?"true":v===false?"false":"";
const d=(v:Date|null)=>v?.toISOString().slice(0,10);
const t=(v:"YES"|"NO"|"NA"|null):""|"YES"|"NO"|"NA"=>v??"";

export default async function EditChangeControlPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const [change,lookups]=await Promise.all([getChangeControlDetail(id),getChangeControlLookups()]);
  if(!change) notFound();
  const defaults:ChangeControlFormDefaults={
    businessCode:change.qmsRecord.businessCode??undefined,
    departmentId:change.departmentId??undefined,
    requestedAt:d(change.requestedAt),
    requesterName:change.requesterName??undefined,
    requesterPosition:change.requesterPosition??undefined,
    scopes:change.scopes,
    scopeOther:change.scopeOther??undefined,
    description:change.description??undefined,
    justification:change.justification??undefined,
    supportingDocuments:change.supportingDocuments??undefined,
    requestStatus:change.requestStatus,
    requestResponsible:change.requestResponsible??undefined,
    acceptedByText:change.acceptedByText??undefined,
    requestDecisionAt:d(change.requestDecisionAt),
    evaluation:change.evaluation??undefined,
    classification:change.classification??undefined,
    plannedImplementationAt:d(change.plannedImplementationAt),
    committeeRequired:b(change.committeeRequired),
    committeeJustification:change.committeeJustification??undefined,
    clientNotificationRequired:b(change.clientNotificationRequired),
    clientNotificationDetail:change.clientNotificationDetail??undefined,
    authorityNotificationRequired:b(change.authorityNotificationRequired),
    authorityNotificationDetail:change.authorityNotificationDetail??undefined,
    pqrRequirement:t(change.pqrRequirement),
    pqrProducts:change.pqrProducts??undefined,
    pqrPeriod:change.pqrPeriod??undefined,
    stabilityRequirement:t(change.stabilityRequirement),
    stabilityAccelerated:change.stabilityAccelerated??false,
    stabilityOngoing:change.stabilityOngoing??false,
    stabilityDetail:change.stabilityDetail??undefined,
    additionalAnalysis:t(change.additionalAnalysis),
    additionalAnalysisDetail:change.additionalAnalysisDetail??undefined,
    additionalValidation:t(change.additionalValidation),
    additionalValidationDetail:change.additionalValidationDetail??undefined,
    otherImplication:b(change.otherImplication),
    otherImplicationDetail:change.otherImplicationDetail??undefined,
    decisionResult:change.decisionResult,
    decisionAt:d(change.decisionAt),
    followupResponsible:change.followupResponsible??undefined,
    decisionObservations:change.decisionObservations??undefined,
    approvedByText:change.approvedByText??undefined,
    executionStatus:change.executionStatus,
    executedAt:d(change.executedAt),
    operationalClosedAt:d(change.operationalClosedAt),
    effectivenessStatus:change.effectivenessStatus,
    effectivenessObservations:change.effectivenessObservations??undefined,
    effectiveClosedAt:d(change.effectiveClosedAt),
    status:change.status,
    closeWithoutExecution:change.closeWithoutExecution,
    closureConclusion:change.closureConclusion??undefined,
    internalObservations:change.internalObservations??undefined,
    signedDocumentAvailable:b(change.signedDocumentAvailable),
    dataQualityStatus:change.dataQualityStatus,
    actions:change.actions.map((item)=>({
      departmentText:item.departmentText??"",
      description:item.description,
      responsible:item.responsible??"",
      plannedExecutionDate:d(item.plannedExecutionDate)??"",
      actualExecutionDate:d(item.actualExecutionDate)??"",
      completed:item.completed,
      evidenceComment:item.evidenceComment??"",
      introducedInSequence:item.introducedInSequence,
    })),
  };
  return <section className="workspace">
    <div className="page-heading"><div><p className="eyebrow">Control de cambios</p><h1>Editar {change.qmsRecord.businessCode}</h1><p>Las modificaciones quedan registradas y actualizan únicamente la versión funcional vigente.</p></div></div>
    <ChangeControlForm mode="edit" action={updateChangeControlAction.bind(null,id)} departments={lookups.departments} defaults={defaults} changeId={id}/>
  </section>;
}
