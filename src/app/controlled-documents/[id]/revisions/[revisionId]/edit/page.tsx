import { DocumentLink as Link } from "@/modules/controlled-documents/components/document-link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DocumentForm } from "@/modules/controlled-documents/components/document-form";
export const dynamic = "force-dynamic";
export default async function EditRevisionPage({ params }: {
    params: Promise<{
        id: string;
        revisionId: string;
    }>;
}) {
    const { id, revisionId } = await params;
    const master = await prisma.controlledDocument.findUnique({ where: { id }, include: { revisions: { orderBy: { revisionCode: "desc" } } } });
    const revision = master?.revisions.find(r => r.id === revisionId);
    if (!master || master.administrativeStatus !== "ACTIVE" || !revision || revision.status !== "DRAFT" || revision.consolidatedAt)
        notFound();
    return <section className="workspace form-page pnt-workspace"><header className="page-heading"><div><p className="eyebrow">Gestión documental · PNT</p><h1>Editar revisión en elaboración</h1></div><Link className="button" href={`/controlled-documents/${id}?tab=revisions`}>Volver a revisiones</Link></header><DocumentForm master={master} revision={revision} departments={[]} revisions={master.revisions} revisionOnly/></section>;
}
