import { authorizedPage } from "@/lib/auth/page-guard";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getBatch } from "@/modules/controlled-documents/import/service";
import { prisma } from "@/lib/db";
import { ImportBatch } from "@/modules/controlled-documents/components/import-batch";
export const dynamic = "force-dynamic";
async function BatchPageAuthenticatedContent({params}: {params: Promise<{id: string}>}) {
    const {id} = await params;
    if (!z.string().uuid().safeParse(id).success) notFound();
    const exists = await prisma.controlledDocumentImportBatch.findUnique({where: {id}, select: {id: true}});
    if (!exists) notFound();
    const [batch, departments] = await Promise.all([getBatch(id), prisma.department.findMany({orderBy: {code: "asc"}, select: {id: true, code: true, name: true, isActive: true}})]);
    return <section className="workspace"><ImportBatch initial={JSON.parse(JSON.stringify(batch))} departments={departments}/></section>;
}

export default async function BatchPage(...args: Parameters<typeof BatchPageAuthenticatedContent>) {
  return authorizedPage("src/app/controlled-documents/import-index/[id]/page.tsx", () => BatchPageAuthenticatedContent(...args));
}
