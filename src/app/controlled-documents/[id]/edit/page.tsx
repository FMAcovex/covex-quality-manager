import { authorizedPage } from "@/lib/auth/page-guard";
import { withReturnTo } from "@/modules/controlled-documents/navigation";
import { DocumentLink as Link } from "@/modules/controlled-documents/components/document-link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DocumentForm } from "@/modules/controlled-documents/components/document-form";
export const dynamic = "force-dynamic";
async function EditPageAuthenticatedContent({ params, searchParams }: {
    searchParams: Promise<{ returnTo?: string }>;
    params: Promise<{
        id: string;
    }>;
}) {
    const { returnTo } = await searchParams;
    const { id } = await params;
    const [master, departments] = await Promise.all([prisma.controlledDocument.findUnique({ where: { id } }), prisma.department.findMany({ orderBy: { code: "asc" } })]);
    if (!master || master.administrativeStatus === "ANNULLED")
        notFound();
    return <section className="workspace form-page pnt-workspace"><header className="page-heading"><div><p className="eyebrow">Gestión documental · PNT</p><h1>Editar maestro PNT</h1></div><Link className="button" href={withReturnTo(`/controlled-documents/${id}`, returnTo)}>Volver a la ficha</Link></header><DocumentForm returnTo={returnTo} master={master} departments={departments}/></section>;
}

export default async function EditPage(...args: Parameters<typeof EditPageAuthenticatedContent>) {
  return authorizedPage("src/app/controlled-documents/[id]/edit/page.tsx", () => EditPageAuthenticatedContent(...args), args);
}
