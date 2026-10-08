import { DocumentLink as Link } from "@/modules/controlled-documents/components/document-link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DocumentForm } from "@/modules/controlled-documents/components/document-form";
export const dynamic = "force-dynamic";
export default async function RevisionPage({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await params;
    const master = await prisma.controlledDocument.findUnique({ where: { id }, include: { revisions: { orderBy: { revisionCode: "desc" } } } });
    if (!master || master.administrativeStatus !== "ACTIVE")
        notFound();
    return <section className="workspace"><Link href={`/controlled-documents/${id}`}>Volver a la ficha</Link><h1>Añadir revisión de {master.baseCode}</h1><DocumentForm master={master} departments={[]} revisions={master.revisions} revisionOnly/></section>;
}
