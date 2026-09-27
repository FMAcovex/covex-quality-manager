import { notFound } from "next/navigation";
import { updateCapaAction } from "@/modules/capa/actions";
import { CapaForm } from "@/modules/capa/components/capa-form";
import { getCapaDetail, getCapaLookups } from "@/modules/capa/queries";

export const dynamic = "force-dynamic";

export default async function EditCapaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [capa, lookups] = await Promise.all([getCapaDetail(id), getCapaLookups()]);
  if (!capa) notFound();

  const defaults = {
    businessCode: capa.qmsRecord.businessCode ?? undefined,
    actionType: capa.actionType,
    departmentId: capa.departmentId ?? undefined,
    openedAt: capa.openedAt?.toISOString().slice(0,10),
    createdByText: capa.createdByText ?? undefined,
    originType: capa.originType ?? undefined,
    originCode: capa.originCode ?? undefined,
    applicableTo: capa.applicableTo ?? undefined,
    defectDescription: capa.defectDescription ?? undefined,
    rootCause: capa.rootCause ?? undefined,
    impactAssessment: capa.impactAssessment ?? undefined,
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
    signedDocumentAvailable: capa.signedDocumentAvailable === true ? "true" as const : capa.signedDocumentAvailable === false ? "false" as const : "",
    dataQualityStatus: capa.dataQualityStatus,
    plannedActions: capa.plannedActions.map((item) => ({
      description: item.description,
      responsible: item.responsible ?? "",
      plannedExecutionDate: item.plannedExecutionDate?.toISOString().slice(0,10) ?? "",
      impact: item.impact ?? "",
    })),
  };

  const action = updateCapaAction.bind(null, id);
  return (
    <section className="workspace">
      <div className="page-heading"><div><p className="eyebrow">CAPA</p><h1>Editar {capa.qmsRecord.businessCode}</h1><p>Los expedientes cerrados permanecen editables en V1 con historial de cambios.</p></div></div>
      <CapaForm mode="edit" action={action} departments={lookups.departments} defaults={defaults} capaId={id} />
    </section>
  );
}
