import { DocumentLink as Link } from "@/modules/controlled-documents/components/document-link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DocumentForm } from "@/modules/controlled-documents/components/document-form";
export const dynamic = "force-dynamic";
export default async function EditPage({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await params;
    const [master, departments] = await Promise.all([prisma.controlledDocument.findUnique({ where: { id } }), prisma.department.findMany({ orderBy: { code: "asc" } })]);
    if (!master || master.administrativeStatus === "ANNULLED")
        notFound();
    return <section className="workspace form-page pnt-workspace"><header className="page-heading"><div><p className="eyebrow">Gestión documental · PNT</p><h1>Editar maestro PNT</h1></div><Link className="button" href={`/controlled-documents/${id}`}>Volver a la ficha</Link></header><DocumentForm master={master} departments={departments}/></section>;
}
