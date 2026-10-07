import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function QmsRecordResolverPage({
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
    },
  });

  if (!record) notFound();
  if (record.audit) redirect(`/audits/${record.audit.id}`);
  if (record.deviation) redirect(`/deviations/${record.deviation.id}`);
  if (record.capa) redirect(`/capa/${record.capa.id}`);
  if (record.changeControl) redirect(`/changes/${record.changeControl.id}`);
  if (record.complaint) redirect(`/complaints/${record.complaint.id}`);
  if (record.returnRecord) redirect(`/returns/${record.returnRecord.id}`);

  notFound();
}
