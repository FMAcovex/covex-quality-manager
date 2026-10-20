import { FormWithIndex } from "@/components/form-with-index";
import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import { appUserOptions } from "@/lib/auth/app-users";
import { notFound } from "next/navigation";
import { qmsDetailUrl, qmsListingReturnTo, qmsDetailTab } from "@/lib/qms/list-return-navigation";
import { updateChangeControlAction } from "@/modules/change-control/actions";
import { ChangeControlForm } from "@/modules/change-control/components/change-control-form";
import { getChangeControlDetail, getChangeControlLookups } from "@/modules/change-control/queries";
import { nextFollowupDateFromHistory } from "@/modules/change-control/domain";

export const dynamic = "force-dynamic";

function boolValue(value: boolean | null): "" | "true" | "false" {
  return value === true ? "true" : value === false ? "false" : "";
}

async function EditChangeControlPageAuthenticatedContent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{returnTo?:string;tab?:string}> }) {
  const { id } = await params;
 const {returnTo,tab}=await searchParams;
 const cancelHref=qmsDetailUrl("/changes",id,returnTo,tab);
  const [record, lookups] = await Promise.all([getChangeControlDetail(id), getChangeControlLookups()]);
  if (!record) notFound();

  const baselineTasks = record.tasks.filter((item) => item.origin === "DICTAMEN");
  const users = await appUserOptions([record.requestDecisionResponsibleUserId, record.followupResponsibleUserId, ...baselineTasks.map((item) => item.responsibleUserId)]);
  const nextFollowupDate = nextFollowupDateFromHistory(record.followups);
  const defaults = {
    businessCode: record.qmsRecord.businessCode ?? undefined,
    departmentId: record.departmentId ?? undefined,
    requestDate: record.requestDate?.toISOString().slice(0, 10),
    requesterName: record.requesterName ?? undefined,
    requesterPosition: record.requesterPosition ?? undefined,
    scope: record.scope,
    otherScope: record.otherScope ?? undefined,
    description: record.description ?? undefined,
    justification: record.justification ?? undefined,
    providedDocuments: record.providedDocuments ?? undefined,
    requestDecision: record.requestDecision,
    requestDecisionResponsible: record.requestDecisionResponsible ?? undefined,
    requestDecisionResponsibleUserId: record.requestDecisionResponsibleUserId,
    requestDecisionRole: record.requestDecisionRole ?? undefined,
    requestDecisionDate: record.requestDecisionDate?.toISOString().slice(0, 10),
    evaluation: record.evaluation ?? undefined,
    classification: record.classification ?? undefined,
    plannedImplementationDate: record.plannedImplementationDate?.toISOString().slice(0, 10),
    committeeRequired: boolValue(record.committeeRequired),
    committeeDetails: record.committeeDetails ?? undefined,
    clientNotificationRequired: boolValue(record.clientNotificationRequired),
    clientNotificationDetails: record.clientNotificationDetails ?? undefined,
    authorityRequired: boolValue(record.authorityRequired),
    authorityDetails: record.authorityDetails ?? undefined,
    pqrRequired: record.pqrRequired ?? undefined,
    pqrProducts: record.pqrProducts ?? undefined,
    pqrPeriod: record.pqrPeriod ?? undefined,
    stabilityRequired: record.stabilityRequired ?? undefined,
    stabilityAccelerated: record.stabilityAccelerated,
    stabilityOngoing: record.stabilityOngoing,
    additionalAnalysisRequired: record.additionalAnalysisRequired ?? undefined,
    additionalAnalysisDetails: record.additionalAnalysisDetails ?? undefined,
    additionalValidationRequired: record.additionalValidationRequired ?? undefined,
    additionalValidationDetails: record.additionalValidationDetails ?? undefined,
    otherImplicationRequired: boolValue(record.otherImplicationRequired),
    otherImplicationDetails: record.otherImplicationDetails ?? undefined,
    dictamenResult: record.dictamenResult,
    dictamenDate: record.dictamenDate?.toISOString().slice(0, 10),
    followupResponsible: record.followupResponsible ?? undefined,
    followupResponsibleUserId: record.followupResponsibleUserId,
    nextFollowupDate: nextFollowupDate instanceof Date
      ? nextFollowupDate.toISOString().slice(0, 10)
      : nextFollowupDate?.slice(0, 10),
    dictamenObservations: record.dictamenObservations ?? undefined,
    internalObservations: record.internalObservations ?? undefined,
    signedDocumentAvailable: boolValue(record.signedDocumentAvailable),
    dataQualityStatus: record.dataQualityStatus,
    finalStatus: record.finalStatus,
    tasks: baselineTasks.map((item) => ({
      id: item.id,
      departmentId: item.departmentId ?? "",
      description: item.description,
      responsible: item.responsible ?? "",
      responsibleUserId: item.responsibleUserId,
      plannedDate: item.plannedDate?.toISOString().slice(0, 10) ?? "",
    })),
  };

  return (
    <section className="workspace">
      <div className="page-heading">
        <div><p className="eyebrow">Controles de Cambios</p><h1>Editar {record.qmsRecord.businessCode}</h1><p>La línea base del Dictamen se bloquea tras su aprobación.</p></div>
      </div>
      <PermissionGate permission="EDIT"><FormWithIndex id="record-form-body"><ChangeControlForm
        mode="edit"
        action={updateChangeControlAction.bind(null,id)}
        departments={lookups.departments}
        users={users}
        defaults={defaults}
        changeId={id} cancelHref={cancelHref} returnTo={qmsListingReturnTo("/changes",returnTo)} detailTab={qmsDetailTab("/changes",tab)}
        baselineLocked={record.dictamenResult === "APPROVED"}
      /></FormWithIndex></PermissionGate>
    </section>
  );
}

export default async function EditChangeControlPage(...args: Parameters<typeof EditChangeControlPageAuthenticatedContent>) {
  return authorizedPage("src/app/changes/[id]/edit/page.tsx", () => EditChangeControlPageAuthenticatedContent(...args), args);
}
