import { currentIdentity } from "@/lib/auth/context";
import { authorizedRoute } from "@/lib/auth/route-guard";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const payloadSchema = z.object({
  recordIds: z.array(z.string().uuid()).min(1).max(100),
  recipients: z.array(z.string().email()).min(1).max(50),
  ccRecipients: z.array(z.string().email()).max(50).default([]),
  subject: z.string().trim().min(1).max(300),
  message: z.string().max(20000).default(""),
});

async function POSTAuthenticatedContent(request: Request) {
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Los datos del recordatorio no son válidos." },
      { status: 400 },
    );
  }

  const { recordIds, recipients, ccRecipients, subject, message } = parsed.data;
  const uniqueRecordIds = Array.from(new Set(recordIds));

  const records = await prisma.qmsRecord.findMany({
    where: {
      id: { in: uniqueRecordIds },
      isActive: true,
    },
    select: { id: true },
  });

  if (records.length !== uniqueRecordIds.length) {
    return NextResponse.json(
      { error: "Alguno de los expedientes seleccionados ya no está disponible." },
      { status: 409 },
    );
  }

  const batchId = randomUUID();
  const createdByText = (currentIdentity()?.principal.name ?? process.env.DEFAULT_ACTOR_NAME) || "Usuario demo";

  await prisma.reminderLog.createMany({
    data: uniqueRecordIds.map((qmsRecordId) => ({
      qmsRecordId,
      batchId,
      channel: "EMAIL",
      status: "PREPARED",
      recipients,
      ccRecipients,
      subject,
      message,
      createdByText,
    })),
  });

  return NextResponse.json({
    ok: true,
    batchId,
    records: uniqueRecordIds.length,
    status: "PREPARED",
  });
}

export async function POST(...args: Parameters<typeof POSTAuthenticatedContent>) {
  return authorizedRoute("src/app/api/reminders/manual/route.ts", "POST", args, authenticated => POSTAuthenticatedContent(...authenticated as Parameters<typeof POSTAuthenticatedContent>));
}
