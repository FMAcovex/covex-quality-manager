import { reviewListWhere } from "@/lib/qms/review/list-domain";
import { withActiveReviewCounts } from "@/lib/qms/review/list-queries";
import "server-only";
import { Prisma, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validValues, validYears } from "@/lib/qms/list-filters";
import { qmsListPagination } from "@/lib/qms/list-pagination";
import { listRecordWithRelations, listAdministrativeSql } from "@/lib/qms/list-projections";

export type DeviationListFilters = {
  page?: string;
  review?: string;
  q?: string;
  administrative?: string;
  year?: string[];
  department?: string[];
  status?: string[];
  classification?: string[];
  provenance?: string[];
  measures?: string;
  capa?: string;
  deadline?: string;
};

export async function getDeviationList(filters: DeviationListFilters) {
  const and: Prisma.DeviationWhereInput[] = [];
  const reviewWhere = reviewListWhere(filters.review);
  if (reviewWhere) and.push({ qmsRecord: reviewWhere });

  if (filters.administrative === "ANNULLED") {
    and.push({ qmsRecord: { isActive: false } });
  } else if (filters.administrative !== "ALL") {
    and.push({ qmsRecord: { isActive: true } });
  }

  if (filters.q) {
    and.push({
      OR: [
        { qmsRecord: { businessCode: { contains: filters.q, mode: "insensitive" } } },
        { qmsRecord: { annulledBusinessCode: { contains: filters.q, mode: "insensitive" } } },
        { materialProcessAffected: { contains: filters.q, mode: "insensitive" } },
        { provenance: { contains: filters.q, mode: "insensitive" } },
        { whatHappened: { contains: filters.q, mode: "insensitive" } },
        { rootCause: { contains: filters.q, mode: "insensitive" } },
        { internalObservations: { contains: filters.q, mode: "insensitive" } },
        { capaPlans: { some: { description: { contains: filters.q, mode: "insensitive" } } } },
      ],
    });
  }

  const years = validYears(filters.year);
  if (years.length) and.push({ qmsRecord: { year: { in: years } } });
  if (filters.department?.length) and.push({ departmentId: { in: filters.department } });
  const statuses = validValues(filters.status, ["DRAFT", "OPEN", "CLOSED"] as const);
  if (statuses.length) and.push({ status: { in: statuses as ("DRAFT" | "OPEN" | "CLOSED")[] } });
  const classifications = validValues(filters.classification, ["CRITICAL", "MAJOR", "MINOR"] as const);
  if (classifications.length) and.push({ classification: { in: classifications as ("CRITICAL" | "MAJOR" | "MINOR")[] } });
  if (filters.provenance?.length) and.push({ provenance: { in: filters.provenance } });
  if (["NOT_EVALUATED", "IN_TIME", "OUT_OF_TIME", "NA"].includes(filters.deadline ?? "")) {
    and.push({ deadlineStatus: filters.deadline as "NOT_EVALUATED" | "IN_TIME" | "OUT_OF_TIME" | "NA" });
  }
  if (filters.capa === "yes") {
    and.push({ OR: [{ capaRequired: true }, { capaPlans: { some: {} } }] });
  }
  if (filters.capa === "no") {
    and.push({
      AND: [
        { OR: [{ capaRequired: false }, { capaRequired: null }] },
        { capaPlans: { none: {} } },
      ],
    });
  }

  if (filters.measures === "none") {
    and.push({
      immediateActions: { none: {} },
      AND: [
        { OR: [{ capaRequired: false }, { capaRequired: null }] },
        { capaPlans: { none: {} } },
      ],
    });
  } else if (filters.measures === "immediate") {
    and.push({
      immediateActions: { some: {} },
      AND: [
        { OR: [{ capaRequired: false }, { capaRequired: null }] },
        { capaPlans: { none: {} } },
      ],
    });
  } else if (filters.measures === "capa") {
    and.push({
      immediateActions: { none: {} },
      OR: [{ capaRequired: true }, { capaPlans: { some: {} } }],
    });
  } else if (filters.measures === "both") {
    and.push({
      immediateActions: { some: {} },
      OR: [{ capaRequired: true }, { capaPlans: { some: {} } }],
    });
  }

  const where: Prisma.DeviationWhereInput = and.length ? { AND: and } : {};
  const administrativeWhere: Prisma.DeviationWhereInput =
    filters.administrative === "ANNULLED"
      ? { qmsRecord: { isActive: false } }
      : filters.administrative === "ALL"
        ? {}
        : { qmsRecord: { isActive: true } };

  const pagination = qmsListPagination(await prisma.deviation.count({ where }), filters.page);
  const now = new Date();
  const [rows, departments, yearRows, provenanceRows, total, drafts, open, overdue, followupDue] =
    await Promise.all([
      prisma.deviation.findMany({
        where,
        select: {
          departmentId: true,
          id: true, qmsRecordId: true, departmentCodeSnapshot: true,
          materialProcessAffected: true, provenance: true, whatHappened: true,
          classification: true, rootCause: true, issueDate: true, closedAt: true,
          status: true, deadlineStatus: true, capaRequired: true, signedDocumentAvailable: true,
          dataQualityStatus: true, internalObservations: true,
          qmsRecord: { select: listRecordWithRelations },
          department: { select: { code: true } },
          immediateActions: { select: { id: true } },
          capaPlans: { select: { description: true } },
        },
        orderBy: [{ status: "asc" }, { issueDate: "desc" }, { createdAt: "desc" }, { id: "asc" }],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
      prisma.qmsRecord.findMany({
        where: { recordType: QmsRecordType.DEVIATION, year: { not: null } },
        select: { year: true },
        distinct: ["year"],
        orderBy: { year: "desc" },
      }),
      prisma.deviation.findMany({
        where: { provenance: { not: null } },
        select: { provenance: true },
        distinct: ["provenance"],
        orderBy: { provenance: "asc" },
      }),
      prisma.deviation.count({ where: { AND: [administrativeWhere, { status: { not: "DRAFT" } }] } }),
      prisma.deviation.count({ where: { AND: [administrativeWhere, { status: "DRAFT" }] } }),
      prisma.deviation.count({ where: { AND: [administrativeWhere, { status: "OPEN" }] } }),
      prisma.deviation.count({ where: { AND: [administrativeWhere, { status: "OPEN", deadlineStatus: "OUT_OF_TIME" }] } }),
      prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM "Deviation" d JOIN "QmsRecord" q ON q.id=d."qmsRecordId"
        WHERE d.status='OPEN' ${listAdministrativeSql(filters.administrative)}
        AND (SELECT f."nextFollowupDate" FROM "DeviationFollowup" f WHERE f."deviationId"=d.id
             ORDER BY f."followupDate" DESC, f."createdAt" DESC LIMIT 1) <= ${now}`),
    ]);

  return {
    rows: await withActiveReviewCounts(rows),
    pagination,
    departments,
    years: yearRows.map((row) => row.year).filter((value): value is number => value !== null),
    provenances: provenanceRows
      .map((row) => row.provenance)
      .filter((value): value is string => Boolean(value)),
    counters: {
      total,
      drafts,
      open,
      overdue,
      followupDue: followupDue[0].count,
    },
  };
}

export async function getDeviationDetail(id: string) {
  return prisma.deviation.findUnique({
    where: { id },
    include: {
      qmsRecord: {
        include: {
          sourceRelations: {
            where: { isActive: true },
            include: { targetRecord: true },
          },
          targetRelations: {
            where: { isActive: true },
            include: { sourceRecord: true },
          },
          history: { orderBy: { changedAt: "desc" }, take: 100 },
          reminders: { orderBy: { createdAt: "desc" }, take: 50 },
          versions: {
            orderBy: { sequenceNumber: "asc" },
            include: {
              documents: {
                orderBy: { uploadedAt: "desc" },
                select: {
                  id: true,
                  kind: true,
                  fileName: true,
                  fileSize: true,
                  checksum: true,
                  uploadedByText: true,
                  uploadedAt: true,
                },
              },
            },
          },
          generatedDocuments: { orderBy: { generatedAt: "desc" } },
        },
      },
      department: true,
      immediateActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: { orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }] },
      capaPlans: { orderBy: { createdAt: "asc" }, include: { linkedCapaRecord: true } },
      formVersion: true,
      anexoIIITemplateVersion: true,
    },
  });
}

export async function getDeviationFormLookups() {
  const [departments, formVersions, templates] = await Promise.all([
    prisma.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.formVersion.findMany({
      where: { module: "DEVIATION", isActive: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.templateVersion.findMany({
      where: {
        module: "DEVIATION",
        documentType: "DEVIATION_ANNEX_III",
        isActive: true,
      },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);

  return { departments, formVersions, templates };
}
