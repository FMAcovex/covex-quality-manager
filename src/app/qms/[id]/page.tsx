import { authorizedPage } from "@/lib/auth/page-guard";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function QmsRecordResolverPageAuthenticatedContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await prisma.qmsRecord.findUnique({
    where: { id },
    select: {
      audit: { select: { id: true } },
      deviation: { select: { id: true } },
      capa: { select: { id: true } },
      changeControl: { select: { id: true } },
      complaint: { select: { id: true } },
      returnRecord: { select: { id: true } },
      oosRecord: { select: { id: true } },
    },
  });

  if (!record) notFound();
  if (record.audit) redirect(`/audits/${record.audit.id}`);
  if (record.deviation) redirect(`/deviations/${record.deviation.id}`);
  if (record.capa) redirect(`/capa/${record.capa.id}`);
  if (record.changeControl) redirect(`/changes/${record.changeControl.id}`);
  if (record.complaint) redirect(`/complaints/${record.complaint.id}`);
  if (record.returnRecord) redirect(`/returns/${record.returnRecord.id}`);
  if (record.oosRecord) redirect(`/oos/${record.oosRecord.id}`);

  notFound();
}

export default async function QmsRecordResolverPage(...args: Parameters<typeof QmsRecordResolverPageAuthenticatedContent>) {
  return authorizedPage("src/app/qms/[id]/page.tsx", () => QmsRecordResolverPageAuthenticatedContent(...args), args);
}
