import { PermissionGate } from "@/components/permissions";
import { currentActor } from "@/lib/auth/presentation";
import { authorizedPage } from "@/lib/auth/page-guard";
import { createCapaAction } from "@/modules/capa/actions";
import { CapaForm } from "@/modules/capa/components/capa-form";
import { getCapaLookups, getComplaintPlanPrefill, getComplaintPrefill, getDeviationPlanPrefill } from "@/modules/capa/queries";

export const dynamic = "force-dynamic";

async function NewCapaPageAuthenticatedContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const fromDeviationPlanId =
    typeof params.fromDeviationPlanId === "string" ? params.fromDeviationPlanId : undefined;
  const fromComplaintPlanId =
    typeof params.fromComplaintPlanId === "string" ? params.fromComplaintPlanId : undefined;
  const fromComplaintId =
    typeof params.fromComplaintId === "string" ? params.fromComplaintId : undefined;
  const [{ departments }, deviationPlan, complaintPlan, complaint] = await Promise.all([
    getCapaLookups(),
    fromDeviationPlanId ? getDeviationPlanPrefill(fromDeviationPlanId) : Promise.resolve(null),
    fromComplaintPlanId ? getComplaintPlanPrefill(fromComplaintPlanId) : Promise.resolve(null),
    fromComplaintId ? getComplaintPrefill(fromComplaintId) : Promise.resolve(null),
  ]);

  const defaults = deviationPlan
    ? {
        actionType: deviationPlan.actionType,
        departmentId: deviationPlan.deviation.departmentId ?? undefined,
        openedAt: new Date().toISOString().slice(0, 10),
        originType: "Desviación",
        originCode: deviationPlan.deviation.qmsRecord.businessCode ?? undefined,
        origins: deviationPlan.deviation.qmsRecord.businessCode ? [{
          id: deviationPlan.deviation.qmsRecord.id,
          recordType: "DEVIATION" as const,
          businessCode: deviationPlan.deviation.qmsRecord.businessCode,
          year: deviationPlan.deviation.qmsRecord.year,
        }] : [],
        applicableTo: deviationPlan.deviation.materialProcessAffected ?? undefined,
        defectDescription: deviationPlan.deviation.whatHappened ?? undefined,
        rootCause: deviationPlan.deviation.rootCause ?? undefined,
        plannedActions: [{
          description: deviationPlan.description,
          responsible: deviationPlan.responsible ?? "",
          plannedExecutionDate: deviationPlan.plannedExecutionDate?.toISOString().slice(0,10) ?? "",
          impact: "",
        }],
        createdByText: currentActor(),
      }
    : complaintPlan
      ? {
          actionType: complaintPlan.actionType,
          departmentId: complaintPlan.complaint.departmentId ?? undefined,
          openedAt: new Date().toISOString().slice(0, 10),
          originType: "Reclamación",
          originCode: complaintPlan.complaint.qmsRecord.businessCode ?? undefined,
          origins: complaintPlan.complaint.qmsRecord.businessCode ? [{
            id: complaintPlan.complaint.qmsRecord.id,
            recordType: "COMPLAINT" as const,
            businessCode: complaintPlan.complaint.qmsRecord.businessCode,
            year: complaintPlan.complaint.qmsRecord.year,
          }] : [],
          applicableTo: complaintPlan.complaint.reference ?? complaintPlan.complaint.affectedScope ?? undefined,
          defectDescription: complaintPlan.complaint.description ?? undefined,
          rootCause: complaintPlan.complaint.rootCause ?? undefined,
          plannedActions: [{
            description: complaintPlan.description,
            responsible: complaintPlan.responsible ?? "",
            plannedExecutionDate: complaintPlan.plannedExecutionDate?.toISOString().slice(0,10) ?? "",
            impact: "",
          }],
          createdByText: currentActor(),
        }
      : complaint
        ? {
            actionType: "CORRECTIVE" as const,
            departmentId: complaint.departmentId ?? undefined,
            openedAt: new Date().toISOString().slice(0, 10),
            originType: "Reclamación",
            originCode: complaint.qmsRecord.businessCode ?? undefined,
            origins: complaint.qmsRecord.businessCode ? [{
              id: complaint.qmsRecord.id,
              recordType: "COMPLAINT" as const,
              businessCode: complaint.qmsRecord.businessCode,
              year: complaint.qmsRecord.year,
            }] : [],
            applicableTo: complaint.reference ?? complaint.affectedScope ?? undefined,
            defectDescription: complaint.description ?? undefined,
            rootCause: complaint.rootCause ?? undefined,
            createdByText: currentActor(),
          }
        : {
          openedAt: new Date().toISOString().slice(0, 10),
          createdByText: currentActor(),
        };

  return (
    <section className="workspace">
      <div className="page-heading">
        <div><p className="eyebrow">CAPA</p><h1>Nueva CAPA</h1><p>Informe y seguimiento de acción conforme a GC-00/030/05.</p></div>
      </div>
      {deviationPlan ? <div className="analytics-note"><strong>Origen:</strong> esta CAPA se está creando desde una propuesta de la desviación {deviationPlan.deviation.qmsRecord.businessCode}.</div> : null}
      {complaintPlan ? <div className="analytics-note"><strong>Origen:</strong> esta CAPA se está creando desde una propuesta de la reclamación {complaintPlan.complaint.qmsRecord.businessCode}.</div> : null}
      {complaint ? <div className="analytics-note"><strong>Origen:</strong> esta CAPA se está creando directamente desde la reclamación {complaint.qmsRecord.businessCode}.</div> : null}
      <PermissionGate permission="CREATE"><CapaForm
        mode="create"
        action={createCapaAction}
        departments={departments}
        defaults={defaults}
        fromDeviationPlanId={fromDeviationPlanId}
        fromComplaintPlanId={fromComplaintPlanId}
        fromComplaintId={fromComplaintId}
      /></PermissionGate>
    </section>
  );
}

export default async function NewCapaPage(...args: Parameters<typeof NewCapaPageAuthenticatedContent>) {
  return authorizedPage("src/app/capa/new/page.tsx", () => NewCapaPageAuthenticatedContent(...args), args);
}
