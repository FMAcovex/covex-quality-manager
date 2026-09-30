import { QmsRecordType, QmsRelationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canRelate } from "@/lib/qms/relation-rules";

export const runtime = "nodejs";

const recordTypes = new Set(Object.values(QmsRecordType));

function asRecordType(value: string | null) {
  return value && recordTypes.has(value as QmsRecordType)
    ? (value as QmsRecordType)
    : null;
}

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const currentRecordId = url.searchParams.get("currentRecordId")?.trim() || "";
  const currentType = asRecordType(url.searchParams.get("currentType"));
  const relatedType = asRecordType(url.searchParams.get("relatedType"));
  const query = url.searchParams.get("q")?.trim() || "";

  if (!currentRecordId || !currentType || !relatedType) {
    return NextResponse.json(
      { error: "Expediente actual y tipos de relación válidos son obligatorios." },
      { status: 400 },
    );
  }

  const direct = canRelate(
    currentType,
    relatedType,
    QmsRelationType.GENERATES,
  );
  const inverse = canRelate(
    relatedType,
    currentType,
    QmsRelationType.GENERATES,
  );
  if (!direct && !inverse) {
    return NextResponse.json(
      { error: "La relación solicitada no está permitida." },
      { status: 400 },
    );
  }

  if (!query) {
    return NextResponse.json({ suggestions: [] });
  }

  const current = await prisma.qmsRecord.findUnique({
    where: { id: currentRecordId },
    select: { id: true, recordType: true, isActive: true },
  });
  if (!current || current.recordType !== currentType) {
    return NextResponse.json(
      { error: "El expediente actual no existe o no coincide con el tipo indicado." },
      { status: 404 },
    );
  }
  if (!current.isActive) {
    return NextResponse.json(
      { error: "Un expediente anulado no puede crear nuevas relaciones." },
      { status: 409 },
    );
  }

  const activeRelations = direct
    ? await prisma.qmsRelation.findMany({
        where: {
          sourceRecordId: currentRecordId,
          relationType: QmsRelationType.GENERATES,
          isActive: true,
        },
        select: { targetRecordId: true },
      })
    : await prisma.qmsRelation.findMany({
        where: {
          targetRecordId: currentRecordId,
          relationType: QmsRelationType.GENERATES,
          isActive: true,
        },
        select: { sourceRecordId: true },
      });

  const alreadyLinkedIds = activeRelations.map((relation) =>
    direct ? relation.targetRecordId : relation.sourceRecordId,
  );

  const records = await prisma.qmsRecord.findMany({
    where: {
      recordType: relatedType,
      isActive: true,
      id: {
        notIn: [currentRecordId, ...alreadyLinkedIds],
      },
      businessCode: {
        not: null,
        contains: query,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      recordType: true,
      businessCode: true,
      year: true,
    },
    take: 30,
  });

  const queryNormalized = normalized(query);
  const suggestions = records
    .filter((record) => Boolean(record.businessCode))
    .map((record) => {
      const code = record.businessCode!;
      const codeNormalized = normalized(code);
      const score =
        codeNormalized === queryNormalized
          ? 0
          : codeNormalized.startsWith(queryNormalized)
            ? 1
            : 2;
      return {
        id: record.id,
        recordType: record.recordType,
        businessCode: code,
        year: record.year,
        score,
      };
    })
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.businessCode.localeCompare(b.businessCode, "es"),
    )
    .slice(0, 8)
    .map(({ id, recordType, businessCode, year }) => ({
      id,
      recordType,
      businessCode,
      year,
    }));

  return NextResponse.json({ suggestions });
}
