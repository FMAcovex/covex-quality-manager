import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const payloadSchema = z.object({
  action: z.enum(["ANNUL", "REACTIVATE"]),
  reason: z.string().trim().min(3).max(2000),
  actor: z.string().trim().min(1).max(200),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Acción, motivo y usuario son obligatorios." },
      { status: 400 },
    );
  }

  const { action, reason, actor } = parsed.data;
  const record = await prisma.qmsRecord.findUnique({ where: { id } });

  if (!record) {
    return NextResponse.json({ error: "El expediente ya no existe." }, { status: 404 });
  }

  if (action === "ANNUL") {
    if (!record.isActive) {
      return NextResponse.json({ error: "El expediente ya está anulado." }, { status: 409 });
    }

    const originalCode = record.businessCode;

    await prisma.$transaction(async (tx) => {
      await tx.qmsRecord.update({
        where: { id },
        data: {
          businessCode: null,
          annulledBusinessCode: originalCode,
          isActive: false,
          annulledAt: new Date(),
          annulledByText: actor,
          annulledReason: reason,
        },
      });

      await tx.changeHistory.create({
        data: {
          qmsRecordId: id,
          changedByText: actor,
          fieldPath: "__administrative_status__",
          oldValue: { isActive: true, businessCode: originalCode },
          newValue: { isActive: false, annulledBusinessCode: originalCode },
          reason,
          source: "UI",
        },
      });
    });

    return NextResponse.json({ ok: true, status: "ANNULLED" });
  }

  if (record.isActive) {
    return NextResponse.json({ error: "El expediente ya está activo." }, { status: 409 });
  }

  const originalCode = record.annulledBusinessCode;
  if (!originalCode) {
    return NextResponse.json(
      { error: "El expediente anulado no conserva una codificación histórica válida." },
      { status: 409 },
    );
  }

  const conflict = await prisma.qmsRecord.findFirst({
    where: {
      id: { not: id },
      recordType: record.recordType,
      businessCode: originalCode,
      isActive: true,
    },
    select: { id: true },
  });

  if (conflict) {
    return NextResponse.json(
      {
        error:
          "No se puede reactivar: la codificación original ya ha sido reutilizada por otro expediente activo.",
      },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.qmsRecord.update({
      where: { id },
      data: {
        businessCode: originalCode,
        annulledBusinessCode: null,
        isActive: true,
        annulledAt: null,
        annulledByText: null,
        annulledReason: null,
      },
    });

    await tx.changeHistory.create({
      data: {
        qmsRecordId: id,
        changedByText: actor,
        fieldPath: "__administrative_status__",
        oldValue: { isActive: false, annulledBusinessCode: originalCode },
        newValue: { isActive: true, businessCode: originalCode },
        reason,
        source: "UI",
      },
    });
  });

  return NextResponse.json({ ok: true, status: "ACTIVE" });
}
