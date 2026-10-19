import { authorizedRoute } from "@/lib/auth/route-guard";
import { QmsRecordType, QmsRelationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canRelate } from "@/lib/qms/relation-rules";
import { currentIdentity } from "@/lib/auth/context";
import { canPresent } from "@/lib/auth/presentation";
import { qmsScope } from "@/lib/auth/resources";

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

/** Descripción de un borrador de CAPA o Desviación sin código, para ofrecerlo desde una auditoría. */
function draftDescription(record: { capa?: { status: string; defectDescription: string | null } | null; deviation?: { status: string; whatHappened: string | null } | null }) {
  if (record.capa?.status === "DRAFT") return record.capa.defectDescription?.trim() || null;
  if (record.deviation?.status === "DRAFT") return record.deviation.whatHappened?.trim() || null;
  return null;
}

async function GETAuthenticatedContent(request: Request) {
  const url = new URL(request.url);
  const currentRecordId = url.searchParams.get("currentRecordId")?.trim() || "";
  const currentType = asRecordType(url.searchParams.get("currentType"));
  const relatedType = asRecordType(url.searchParams.get("relatedType"));
  const findingId = url.searchParams.get("findingId")?.trim() || "";
  const query = url.searchParams.get("q")?.trim() || "";

  if (!currentType || !relatedType) {
    return NextResponse.json(
      { error: "Los tipos de relación válidos son obligatorios." },
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

  // R5B1: los borradores (y su texto) solo se ofrecen desde una auditoría y con el filtro de edición,
  // que más abajo descarta lo que el usuario no puede editar.
  const includeDrafts = currentType === "AUDIT" && url.searchParams.get("editable") === "1";
  let alreadyLinkedIds: string[] = [];
  if (currentRecordId) {
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

    if (findingId && currentType !== "AUDIT") return NextResponse.json({ error: "El hallazgo solo se usa desde Auditorías." }, { status: 400 });
    if (findingId) {
      const finding = await prisma.auditFinding.findUnique({ where: { id: findingId }, select: { isActive: true, audit: { select: { qmsRecordId: true } } } });
      if (!finding?.isActive || finding.audit.qmsRecordId !== currentRecordId) return NextResponse.json({ error: "Hallazgo ajeno o retirado." }, { status: 400 });
    }
    const activeRelations = direct
      ? await prisma.qmsRelation.findMany({
          where: { ...(findingId ? { auditFindingRelations: { some: { findingId, isActive: true } } } : {}), sourceRecordId: currentRecordId, relationType: QmsRelationType.GENERATES, isActive: true },
          select: { sourceRecordId: true, targetRecordId: true },
        })
      : await prisma.qmsRelation.findMany({
          where: { targetRecordId: currentRecordId, relationType: QmsRelationType.GENERATES, isActive: true },
          select: { sourceRecordId: true, targetRecordId: true },
        });
    alreadyLinkedIds = activeRelations.map((relation) =>
      direct ? relation.targetRecordId : relation.sourceRecordId,
    );
  }

  const records = await prisma.qmsRecord.findMany({
    where: {
      recordType: relatedType,
      isActive: true,
      id: currentRecordId
        ? { notIn: [currentRecordId, ...alreadyLinkedIds] }
        : { notIn: alreadyLinkedIds },
      ...(relatedType === "AUDIT" ? {
        audit: { status: { not: "DRAFT" } },
        OR: [{ businessCode: { contains: query, mode: "insensitive" } }, { audit: { OR: [{ title: { contains: query, mode: "insensitive" } }, { externalReference: { contains: query, mode: "insensitive" } }] } }],
      } : includeDrafts && relatedType === "CAPA" ? {
        // R5B1: desde una auditoría también se vinculan borradores, que no tienen código hasta abrirse.
        OR: [{ businessCode: { not: null, contains: query, mode: "insensitive" } }, { businessCode: null, capa: { status: "DRAFT", defectDescription: { contains: query, mode: "insensitive" } } }],
      } : includeDrafts && relatedType === "DEVIATION" ? {
        OR: [{ businessCode: { not: null, contains: query, mode: "insensitive" } }, { businessCode: null, deviation: { status: "DRAFT", whatHappened: { contains: query, mode: "insensitive" } } }],
      } : { businessCode: { not: null, contains: query, mode: "insensitive" } }),
    },
    select: {
      id: true,
      recordType: true,
      businessCode: true,
      year: true,
      ...(relatedType === "AUDIT" ? { audit: { select: { title: true, externalReference: true } } } : {}),
      ...(includeDrafts && relatedType === "CAPA" ? { capa: { select: { status: true, defectDescription: true } } } : {}),
      ...(includeDrafts && relatedType === "DEVIATION" ? { deviation: { select: { status: true, whatHappened: true } } } : {}),
    },
    take: 30,
  });

  const queryNormalized = normalized(query);
  const suggestions = records
    .filter((record) => record.recordType === "AUDIT" || Boolean(record.businessCode) || Boolean(draftDescription(record)))
    .map((record) => {
      const draft = !record.businessCode ? draftDescription(record) : null;
      const code = record.businessCode || record.audit?.externalReference || record.audit?.title || (draft ? `Borrador · ${draft.slice(0, 60)}` : record.id);
      const codeNormalized = normalized(code);
      const score =
        draft
          ? 3
          : codeNormalized === queryNormalized
          ? 0
          : codeNormalized.startsWith(queryNormalized)
            ? 1
            : 2;
      return {
        id: record.id,
        recordType: record.recordType,
        businessCode: record.businessCode ?? "",
        displayLabel: code,
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
    .map(({ id, recordType, businessCode, year, displayLabel }) => ({
      id,
      recordType,
      businessCode,
      year,
      displayLabel,
    }));

  if (url.searchParams.get("editable") === "1") {
    const user = currentIdentity()?.principal;
    const permitted = await Promise.all(suggestions.map(async record => {
      if (!user) return false;
      if (canPresent(user, record.recordType, "EDIT")) return true;
      const target = await qmsScope(record.id);
      return canPresent(user, target.module, "EDIT", target.scope);
    }));
    return NextResponse.json({ suggestions: suggestions.filter((_, i) => permitted[i]) });
  }
  return NextResponse.json({ suggestions });
}

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/qms/relation-suggestions/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
