import { authorizedPage } from "@/lib/auth/page-guard";
import { notFound } from "next/navigation";
import { qmsDetailUrl, qmsListingReturnTo, qmsDetailTab } from "@/lib/qms/list-return-navigation";
import { updateCapaAction } from "@/modules/capa/actions";
import { CapaForm } from "@/modules/capa/components/capa-form";
import { getCapaDetail, getCapaLookups, getCapaOriginRecords } from "@/modules/capa/queries";

export const dynamic = "force-dynamic";

async function EditCapaPageAuthenticatedContent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{returnTo?:string;tab?:string}> }) {
  const { id } = await params;
 const {returnTo,tab}=await searchParams;
 const cancelHref=qmsDetailUrl("/capa",id,returnTo,tab);
  const [capa, lookups] = await Promise.all([getCapaDetail(id), getCapaLookups()]);
  if (!capa) notFound();

  const pendingOriginIds =
    capa.status === "DRAFT" && capa.extraData && typeof capa.extraData === "object" && !Array.isArray(capa.extraData)
      ? ((capa.extraData as { pendingOriginIds?: string[] }).pendingOriginIds ?? [])
      : [];
  const pendingOrigins = await getCapaOriginRecords(pendingOriginIds);
  const relationOrigins = capa.qmsRecord.targetRelations
    .filter((item) => item.relationType === "GENERATES" && (item.sourceRecord.recordType === "DEVIATION" || item.sourceRecord.recordType === "COMPLAINT" || item.sourceRecord.recordType === "AUDIT"))
    .map((item) => item.sourceRecord);
  const originRecords = relationOrigins.length ? relationOrigins : pendingOrigins;

  const defaults = {
    businessCode: capa.qmsRecord.businessCode ?? undefined,
    actionType: capa.actionType,
    departmentId: capa.departmentId ?? undefined,
    openedAt: capa.openedAt?.toISOString().slice(0,10),
    createdByText: capa.createdByText ?? undefined,
    originType: capa.originType ?? undefined,
    originCode: capa.originCode ?? undefined,
    origins: originRecords
      .filter(record => record.recordType === "AUDIT" || Boolean(record.businessCode))
      .map((record) => ({
        id: record.id,
        recordType: record.recordType as "DEVIATION" | "COMPLAINT" | "AUDIT",
        businessCode: record.businessCode ?? "",
        year: record.year,
      })),
    applicableTo: capa.applicableTo ?? undefined,
    defectDescription: capa.defectDescription ?? undefined,
    rootCause: capa.rootCause ?? undefined,
    impactAssessment: capa.impactAssessment ?? undefined,
    // Se fuerza una nueva fecha en cada edición/seguimiento para evitar arrastrar la anterior.
    nextFollowupDate: undefined,
    actionFollowupObservations: capa.actionFollowupObservations ?? undefined,
    operationalStatusDescription: capa.operationalStatusDescription ?? undefined,
    actionFollowups: capa.actionFollowups.map((item) => ({
      followupDate: item.followupDate?.toISOString().slice(0,10) ?? "",
      description: item.description ?? "",
    })),
    status: capa.status,
    cancellationReason: capa.cancellationReason ?? undefined,
    operationalClosedAt: capa.operationalClosedAt?.toISOString().slice(0,10),
    effectivenessStatus: capa.effectivenessStatus,
    effectivenessCriteria: capa.effectivenessCriteria ?? undefined,
    effectivenessAssessment: capa.effectivenessAssessment ?? undefined,
    effectivenessEvidence: capa.effectivenessEvidence ?? undefined,
    effectiveClosedAt: capa.effectiveClosedAt?.toISOString().slice(0,10),
    conclusion: capa.conclusion ?? undefined,
    internalObservations: capa.internalObservations ?? undefined,
    signedDocumentAvailable:
      capa.signedDocumentAvailable === true
        ? ("true" as const)
        : capa.signedDocumentAvailable === false
          ? ("false" as const)
          : ("" as const),
    dataQualityStatus: capa.dataQualityStatus,
    plannedActions: capa.plannedActions.map((item) => ({
      description: item.description,
      responsible: item.responsible ?? "",
      plannedExecutionDate: item.plannedExecutionDate?.toISOString().slice(0,10) ?? "",
      impact: item.impact ?? "",
    })),
  };

  const action = updateCapaAction.bind(null,id);
  return (
    <section className="workspace">
      <div className="page-heading"><div><p className="eyebrow">CAPA</p><h1>Editar {capa.qmsRecord.businessCode}</h1><p>Los expedientes cerrados permanecen editables en V1 con historial de cambios.</p></div></div>
      <CapaForm mode="edit" action={action} departments={lookups.departments} defaults={defaults} capaId={id} cancelHref={cancelHref} returnTo={qmsListingReturnTo("/capa",returnTo)} detailTab={qmsDetailTab("/capa",tab)} qmsRecordId={capa.qmsRecord.id} />
    </section>
  );
}

export default async function EditCapaPage(...args: Parameters<typeof EditCapaPageAuthenticatedContent>) {
  return authorizedPage("src/app/capa/[id]/edit/page.tsx", () => EditCapaPageAuthenticatedContent(...args), args);
}
