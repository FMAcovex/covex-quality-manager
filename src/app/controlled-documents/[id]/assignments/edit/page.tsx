import { authorizedPage } from "@/lib/auth/page-guard";
import { appUserOptions } from "@/lib/auth/app-users";
import { withReturnTo } from "@/modules/controlled-documents/navigation";
import { DocumentLink as Link } from "@/modules/controlled-documents/components/document-link";
import { AssignmentsForm } from "@/modules/controlled-documents/components/assignments-form";
import { assignableRevisionStatuses } from "@/modules/controlled-documents/assignment-functions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
const day = (v: Date | null) => v ? v.toISOString().slice(0, 10) : null;
async function AssignmentsPageAuthenticatedContent({ params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ returnTo?: string }>;
}) {
    const { id } = await params;
    const { returnTo } = await searchParams;
    const master = await prisma.controlledDocument.findUnique({ where: { id }, include: { revisions: { where: { status: { in: [...assignableRevisionStatuses] } }, orderBy: { revisionCode: "desc" } } } });
    if (!master || master.administrativeStatus === "ANNULLED")
        notFound();
    const users = await appUserOptions([master.periodicReviewResponsibleUserId, ...master.revisions.flatMap(r => [r.preparationResponsibleUserId, r.reviewResponsibleUserId, r.approvalResponsibleUserId])]);
    const revisions = master.revisions.map(r => ({
        id: r.id, code: `${r.baseCodeSnapshot || master.baseCode || "Sin código"}/${r.revisionCode}`, status: r.status, updatedAt: r.updatedAt.toISOString(),
        preparation: { text: r.preparationResponsible, userId: r.preparationResponsibleUserId, date: day(r.preparationTargetDate) },
        review: { text: r.reviewResponsible, userId: r.reviewResponsibleUserId, date: day(r.reviewTargetDate) },
        approval: { text: r.approvalResponsible, userId: r.approvalResponsibleUserId, date: day(r.approvalTargetDate) },
    }));
    return <section className="workspace form-page pnt-workspace"><header className="page-heading"><div><p className="eyebrow">Gestión documental · PNT</p><h1>Responsables de {master.baseCode || "Borrador PNT"}</h1><p className="muted-note">{master.title || "Sin título"}</p></div><Link className="button" href={withReturnTo(`/controlled-documents/${id}?tab=revisions`, returnTo)}>Volver a la ficha</Link></header>
        <AssignmentsForm documentId={id} updatedAt={master.updatedAt.toISOString()} periodic={{ text: master.periodicReviewResponsible, userId: master.periodicReviewResponsibleUserId }} revisions={revisions} users={users} returnTo={returnTo}/>
    </section>;
}

export default async function AssignmentsPage(...args: Parameters<typeof AssignmentsPageAuthenticatedContent>) {
  return authorizedPage("src/app/controlled-documents/[id]/assignments/edit/page.tsx", () => AssignmentsPageAuthenticatedContent(...args), args);
}
