import { authorizedPage } from "@/lib/auth/page-guard";
import { withReturnTo } from "@/modules/controlled-documents/navigation";
import { DocumentLink as Link } from "@/modules/controlled-documents/components/document-link";
import { canEditRevision } from "@/modules/controlled-documents/revision-editability";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DocumentForm } from "@/modules/controlled-documents/components/document-form";
export const dynamic = "force-dynamic";
async function EditRevisionPageAuthenticatedContent({ params, searchParams }: {
    searchParams: Promise<{ returnTo?: string }>;
    params: Promise<{
        id: string;
        revisionId: string;
    }>;
}) {
    const { returnTo } = await searchParams;
    const { id, revisionId } = await params;
    const master = await prisma.controlledDocument.findUnique({ where: { id }, include: { revisions: { orderBy: { revisionCode: "desc" }, include: { lifecycle: true, decisions: true } } } });
    const revision = master?.revisions.find(r => r.id === revisionId);
    if (!master || master.administrativeStatus !== "ACTIVE" || !revision || !canEditRevision(revision))
        notFound();
    return <section className="workspace form-page pnt-workspace"><header className="page-heading"><div><p className="eyebrow">Gestión documental · PNT</p><h1>Editar revisión en elaboración</h1></div><Link className="button" href={withReturnTo(`/controlled-documents/${id}?tab=revisions`, returnTo)}>Volver a revisiones</Link></header><DocumentForm allowExistingRegistration={!revision.lifecycle} returnTo={returnTo} master={master} revision={revision} departments={[]} revisions={master.revisions} revisionOnly/></section>;
}

export default async function EditRevisionPage(...args: Parameters<typeof EditRevisionPageAuthenticatedContent>) {
  return authorizedPage("src/app/controlled-documents/[id]/revisions/[revisionId]/edit/page.tsx", () => EditRevisionPageAuthenticatedContent(...args), args);
}
