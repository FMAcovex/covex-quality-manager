import { DocumentLink as Link } from "@/modules/controlled-documents/components/document-link";
import { prisma } from "@/lib/db";
import { DocumentForm } from "@/modules/controlled-documents/components/document-form";
export const dynamic = "force-dynamic";
export default async function NewPage() { const departments = await prisma.department.findMany({ orderBy: { code: "asc" } }); return <section className="workspace"><Link href="/controlled-documents">Volver al listado</Link><h1>Nuevo PNT</h1><DocumentForm departments={departments}/></section>; }
