import { createCapaAction } from "@/modules/capa/actions";
import { CapaForm } from "@/modules/capa/components/capa-form";
import { getCapaLookups, getDeviationPlanPrefill } from "@/modules/capa/queries";

export const dynamic = "force-dynamic";

export default async function NewCapaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const fromDeviationPlanId =
    typeof params.fromDeviationPlanId === "string" ? params.fromDeviationPlanId : undefined;
  const [{ departments }, plan] = await Promise.all([
    getCapaLookups(),
    fromDeviationPlanId ? getDeviationPlanPrefill(fromDeviationPlanId) : Promise.resolve(null),
  ]);

  const defaults = plan
    ? {
        actionType: plan.actionType,
        departmentId: plan.deviation.departmentId ?? undefined,
        openedAt: new Date().toISOString().slice(0, 10),
        originType: "Desviación",
        originCode: plan.deviation.qmsRecord.businessCode ?? undefined,
        applicableTo: plan.deviation.materialProcessAffected ?? undefined,
        defectDescription: plan.deviation.whatHappened ?? undefined,
        rootCause: plan.deviation.rootCause ?? undefined,
        plannedActions: [{
          description: plan.description,
          responsible: plan.responsible ?? "",
          plannedExecutionDate: plan.plannedExecutionDate?.toISOString().slice(0,10) ?? "",
          impact: "",
        }],
        createdByText: process.env.DEFAULT_ACTOR_NAME || "Usuario demo",
      }
    : {
        openedAt: new Date().toISOString().slice(0, 10),
        createdByText: process.env.DEFAULT_ACTOR_NAME || "Usuario demo",
      };

  return (
    <section className="workspace">
      <div className="page-heading">
        <div><p className="eyebrow">CAPA</p><h1>Nueva CAPA</h1><p>Informe y seguimiento de acción conforme a GC-00/030/05.</p></div>
      </div>
      {plan ? <div className="analytics-note"><strong>Origen:</strong> esta CAPA se está creando desde una propuesta de la desviación {plan.deviation.qmsRecord.businessCode}.</div> : null}
      <CapaForm
        mode="create"
        action={createCapaAction}
        departments={departments}
        defaults={defaults}
        fromDeviationPlanId={fromDeviationPlanId}
      />
    </section>
  );
}
