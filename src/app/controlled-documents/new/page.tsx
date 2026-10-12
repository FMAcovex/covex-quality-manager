import { authorizedPage } from "@/lib/auth/page-guard";
import { listingReturnTo } from "@/modules/controlled-documents/navigation";
import { DocumentLink as Link } from "@/modules/controlled-documents/components/document-link";
import { prisma } from "@/lib/db";
import { DocumentForm } from "@/modules/controlled-documents/components/document-form";
export const dynamic = "force-dynamic";
async function NewPageAuthenticatedContent({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) { const { returnTo } = await searchParams; const departments = await prisma.department.findMany({ orderBy: { code: "asc" } }); return <section className="workspace form-page pnt-workspace"><header className="page-heading"><div><p className="eyebrow">Gestión documental · PNT</p><h1>Nuevo PNT</h1></div><Link className="button" href={listingReturnTo(returnTo)}>Volver al listado</Link></header><DocumentForm returnTo={returnTo} departments={departments}/></section>; }

export default async function NewPage(...args: Parameters<typeof NewPageAuthenticatedContent>) {
  return authorizedPage("src/app/controlled-documents/new/page.tsx", () => NewPageAuthenticatedContent(...args));
}
