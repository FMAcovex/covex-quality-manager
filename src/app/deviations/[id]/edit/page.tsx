import { getSimilarDeviations } from "@/modules/deviations/recurrence-queries";
import { storedAdditionalLots } from "@/lib/qms/additional-lots";
import { authorizedPage } from "@/lib/auth/page-guard";
import { notFound } from "next/navigation";
import { qmsDetailUrl, qmsListingReturnTo, qmsDetailTab } from "@/lib/qms/list-return-navigation";
import Link from "next/link";
import { updateDeviationAction } from "@/modules/deviations/actions";
import { DeviationForm } from "@/modules/deviations/components/deviation-form";
import { getDeviationDetail, getDeviationFormLookups } from "@/modules/deviations/queries";

export const dynamic = "force-dynamic";

function date(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function dateTime(value: Date | null) {
  return value ? value.toISOString().slice(0, 16) : "";
}

async function EditDeviationPageAuthenticatedContent({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{returnTo?: string; tab?: string}>;
}) {
  const { id } = await params;
  const {returnTo, tab} = await searchParams;
  const [deviation, lookups] = await Promise.all([
    getDeviationDetail(id),
    getDeviationFormLookups(),
  ]);
  if (!deviation) notFound();
  const similarDeviations = await getSimilarDeviations(deviation);

  const action = updateDeviationAction.bind(null, id);

  return (
    <section className="form-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Desviaciones</p>
          <h1>{deviation.status === "DRAFT" ? "Editar borrador" : "Editar"} {deviation.qmsRecord.businessCode ?? "desviación"}</h1>
          <p>{deviation.status === "DRAFT" ? "Completa los campos pendientes y abre la desviación cuando esté lista." : "Edita la versión vigente o genera el siguiente seguimiento como una versión completa del expediente."}</p>
        </div>
        <Link className="button" href={qmsDetailUrl("/deviations", id, returnTo, tab)}>← Volver al expediente</Link>
      </div>
      <DeviationForm
        action={action}
        cancelHref={qmsDetailUrl("/deviations", id, returnTo, tab)} returnTo={qmsListingReturnTo("/deviations", returnTo)} detailTab={qmsDetailTab("/deviations", tab)}
        departments={lookups.departments}
        mode="edit"
        deviationId={id}
        currentVersionSequence={deviation.qmsRecord.versions.at(-1)?.sequenceNumber ?? 0}
        similarDeviations={similarDeviations}
        defaults={{
          businessCode: deviation.qmsRecord.businessCode ?? "",
          departmentId: deviation.departmentId ?? "",
          issueDate: date(deviation.issueDate),
          eventDateTime: dateTime(deviation.eventDateTime),
          detectedBy: deviation.detectedBy ?? "",
          createdByText: deviation.createdByText ?? "",
          materialProcessAffected: deviation.materialProcessAffected ?? "",
          provenance: deviation.provenance ?? "",
          affectedDocumentation: deviation.affectedDocumentation ?? "",
          processEquipmentSystem: deviation.processEquipmentSystem ?? "",
          finishedProductSystem: deviation.finishedProductSystem ?? "",
          productLot: deviation.productLot ?? "",
          lotSize: deviation.lotSize ?? "",
          affectedQuantity: deviation.affectedQuantity ?? "",
          client: deviation.client ?? "",
          rawOrPackagingMaterial: deviation.rawOrPackagingMaterial ?? "",
          materialLot: deviation.materialLot ?? "",
          materialLotSize: deviation.materialLotSize ?? "",
          materialAffectedQuantity: deviation.materialAffectedQuantity ?? "",
          supplier: deviation.supplier ?? "",
          supplierLot: deviation.supplierLot ?? "",
          additionalLots: storedAdditionalLots(deviation.additionalLots),
          affectedEquipmentLine: deviation.affectedEquipmentLine ?? "",
          otherOrigin: deviation.otherOrigin ?? "",
          whatHappened: deviation.whatHappened ?? "",
          whoInvolved: deviation.whoInvolved ?? "",
          whenHappened: deviation.whenHappened ?? "",
          whereHappened: deviation.whereHappened ?? "",
          howHappened: deviation.howHappened ?? "",
          investigation: deviation.investigation ?? "",
          investigationConclusive: deviation.investigationConclusive ?? "",
          investigationMethods: deviation.investigationMethods,
          rootCause: deviation.rootCause ?? "",
          rootCauseCategories: deviation.rootCauseCategories,
          recurrentRootCause: deviation.recurrentRootCause ?? "",
          recurrenceDetails: deviation.recurrenceDetails ?? "",
          classification: deviation.classification ?? "",
          validationImpact: deviation.validationImpact ?? "",
          registrationImpact: deviation.registrationImpact ?? "",
          stabilityImpact: deviation.stabilityImpact ?? "",
          otherProcessesImpact: deviation.otherProcessesImpact ?? "",
          otherProcessesImpactDetails: deviation.otherProcessesImpactDetails ?? "",
          affectsFinishedProduct: deviation.affectsFinishedProduct ?? "",
          capaRequired: deviation.capaRequired === true ? "true" : deviation.capaRequired === false ? "false" : "",
          conclusion: deviation.conclusion ?? "",
          disposition: deviation.disposition ?? "",
          dispositionQuantity: deviation.dispositionQuantity ?? "",
          dispositionComments: deviation.dispositionComments ?? "",
          clientNotification: deviation.clientNotification ?? "",
          closedAt: date(deviation.closedAt),
          status: deviation.status,
          internalObservations: deviation.internalObservations ?? "",
          signedDocumentAvailable: deviation.signedDocumentAvailable === true ? "true" : deviation.signedDocumentAvailable === false ? "false" : "",
          dataQualityStatus: deviation.dataQualityStatus,
          immediateActions: deviation.immediateActions.map((item) => ({
            description: item.description,
            executedBy: item.executedBy ?? "",
            executedAt: date(item.executedAt),
          })),
          capaPlans: deviation.capaPlans
            .filter((item) => item.proposalStatus === "PROPOSED")
            .map((item) => ({
              actionType: item.actionType,
              description: item.description,
              plannedExecutionDate: date(item.plannedExecutionDate),
              responsible: item.responsible ?? "",
            })),
        }}
      />
    </section>
  );
}

export default async function EditDeviationPage(...args: Parameters<typeof EditDeviationPageAuthenticatedContent>) {
  return authorizedPage("src/app/deviations/[id]/edit/page.tsx", () => EditDeviationPageAuthenticatedContent(...args), args);
}
