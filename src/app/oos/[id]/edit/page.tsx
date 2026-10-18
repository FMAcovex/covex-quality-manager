import { notFound } from "next/navigation";
import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import { qmsDetailTab, qmsDetailUrl, qmsListingReturnTo } from "@/lib/qms/list-return-navigation";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";
import { updateOosAction } from "@/modules/oos/actions";
import { OosForm } from "@/modules/oos/components/oos-form";
import { readOosEvaluation } from "@/modules/oos/domain";
import { getOosDepartments, getOosDetail } from "@/modules/oos/queries";
import type { OosFormDefaults } from "@/modules/oos/types";

export const dynamic = "force-dynamic";

const day = (value: Date | null) => value?.toISOString().slice(0, 10);
const str = (value: string | null) => value ?? undefined;

async function EditOosPageAuthenticatedContent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string; tab?: string }> }) {
  const { id } = await params;
  const { returnTo, tab } = await searchParams;
  const [record, departments] = await Promise.all([getOosDetail(id), getOosDepartments()]);
  if (!record) notFound();
  const evaluation = readOosEvaluation(record.phaseIEvaluation);
  const defaults: OosFormDefaults = {
    businessCode: str(record.qmsRecord.businessCode),
    status: record.status,
    area: record.area ?? undefined,
    departmentId: str(record.departmentId),
    createdByText: str(record.createdByText),
    issueDate: day(record.issueDate),
    materialKind: record.materialKind ?? undefined,
    materialName: str(record.materialName),
    lotNumber: str(record.lotNumber),
    batchSize: str(record.batchSize),
    affectedQuantity: str(record.affectedQuantity),
    supplier: str(record.supplier),
    supplierLot: str(record.supplierLot),
    process: str(record.process),
    oosDate: day(record.oosDate),
    oosTime: str(record.oosTime),
    detectedBy: str(record.detectedBy),
    shift: str(record.shift),
    detectionDescription: str(record.detectionDescription),
    ...Object.fromEntries(Object.entries(evaluation).map(([key, value]) => [`evaluation.${key}`, value])),
    phaseIInvestigation: str(record.phaseIInvestigation),
    phaseIConclusion: str(record.phaseIConclusion),
    phaseIDisposition: record.phaseIDisposition ?? undefined,
    phaseIVerdict: record.phaseIVerdict ?? undefined,
    phaseIVerdictQuantity: str(record.phaseIVerdictQuantity),
    phaseIDestroyQuantity: str(record.phaseIDestroyQuantity),
    phaseIReturnQuantity: str(record.phaseIReturnQuantity),
    phaseIVerdictOther: str(record.phaseIVerdictOther),
    phaseIIssuedBy: str(record.phaseIIssuedBy),
    phaseIIssuedAt: day(record.phaseIIssuedAt),
    phaseIApprovedBy: str(record.phaseIApprovedBy),
    phaseIApprovedAt: day(record.phaseIApprovedAt),
    phaseIIIssueDate: day(record.phaseIIIssueDate),
    phaseIIProductionReview: str(record.phaseIIProductionReview),
    phaseIIRetesting: str(record.phaseIIRetesting),
    phaseIIResampling: str(record.phaseIIResampling),
    phaseIIConclusion: str(record.phaseIIConclusion),
    phaseIIVerdict: record.phaseIIVerdict ?? undefined,
    phaseIIVerdictQuantity: str(record.phaseIIVerdictQuantity),
    phaseIIDestroyQuantity: str(record.phaseIIDestroyQuantity),
    phaseIIReturnQuantity: str(record.phaseIIReturnQuantity),
    phaseIIVerdictOther: str(record.phaseIIVerdictOther),
    phaseIIIssuedBy: str(record.phaseIIIssuedBy),
    phaseIIIssuedAt: day(record.phaseIIIssuedAt),
    phaseIIAffectedDepartments: str(record.phaseIIAffectedDepartments),
    investigationResult: record.investigationResult ?? undefined,
    rootCauseCategories: record.rootCauseCategories,
    closedAt: day(record.closedAt),
    internalObservations: str(record.internalObservations),
  };
  return <section className="workspace">
    <div className="page-heading"><div><p className="eyebrow">OOS</p><h1>Editar {qmsRecordDisplayCode(record.qmsRecord)}</h1></div></div>
    <PermissionGate permission="EDIT"><OosForm mode="edit" action={updateOosAction.bind(null, id)} departments={departments} defaults={defaults} recordId={id} cancelHref={qmsDetailUrl("/oos", id, returnTo, tab)} returnTo={qmsListingReturnTo("/oos", returnTo)} detailTab={qmsDetailTab("/oos", tab)} /></PermissionGate>
  </section>;
}

export default async function EditOosPage(...args: Parameters<typeof EditOosPageAuthenticatedContent>) {
  return authorizedPage("src/app/oos/[id]/edit/page.tsx", () => EditOosPageAuthenticatedContent(...args), args);
}
