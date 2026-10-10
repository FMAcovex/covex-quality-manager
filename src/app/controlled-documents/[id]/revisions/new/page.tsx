import { withReturnTo } from "@/modules/controlled-documents/navigation";
import { DocumentLink as Link } from "@/modules/controlled-documents/components/document-link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DocumentForm } from "@/modules/controlled-documents/components/document-form";
export const dynamic = "force-dynamic";
export default async function RevisionPage({ params, searchParams }: {
    searchParams: Promise<{ returnTo?: string }>;
    params: Promise<{
        id: string;
    }>;
}) {
    const { returnTo } = await searchParams;
    const { id } = await params;
    const master = await prisma.controlledDocument.findUnique({ where: { id }, include: { revisions: { orderBy: { revisionCode: "desc" } } } });
    if (!master || master.administrativeStatus !== "ACTIVE")
        notFound();
    return <section className="workspace form-page pnt-workspace"><header className="page-heading"><div><p className="eyebrow">Gestión documental · PNT</p><h1>Añadir revisión de {master.baseCode}</h1></div><Link className="button" href={withReturnTo(`/controlled-documents/${id}?tab=revisions`, returnTo)}>Volver a la ficha</Link></header><DocumentForm returnTo={returnTo} master={master} departments={[]} revisions={master.revisions} revisionOnly/></section>;
}
