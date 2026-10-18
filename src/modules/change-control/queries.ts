import { reviewListWhere } from "@/lib/qms/review/list-domain";
import { withActiveReviewCounts } from "@/lib/qms/review/list-queries";
import "server-only";
import { Prisma, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validValues, validYears } from "@/lib/qms/list-filters";
import { qmsListPagination } from "@/lib/qms/list-pagination";
import { listRecordWithRelations, listAdministrativeSql } from "@/lib/qms/list-projections";

export type ChangeControlListFilters = {
  page?: string;
  review?: string;
  q?: string;
  administrative?: string;
  year?: string[];
  department?: string[];
  classification?: string[];
  execution?: string[];
  effectiveness?: string[];
  status?: string[];
};

export async function getChangeControlList(filters: ChangeControlListFilters) {
  const and: Prisma.ChangeControlWhereInput[] = [];
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
        { description: { contains: filters.q, mode: "insensitive" } },
        { justification: { contains: filters.q, mode: "insensitive" } },
        { requesterName: { contains: filters.q, mode: "insensitive" } },
        { internalObservations: { contains: filters.q, mode: "insensitive" } },
        { tasks: { some: { description: { contains: filters.q, mode: "insensitive" } } } },
      ],
    });
  }
  const yearsFilter = validYears(filters.year);
  if (yearsFilter.length) and.push({ qmsRecord: { year: { in: yearsFilter } } });
  if (filters.department?.length) and.push({ departmentId: { in: filters.department } });
  const classifications = validValues(filters.classification, ["MAJOR", "MINOR"] as const);
  if (classifications.length) and.push({ classification: { in: classifications as ("MAJOR" | "MINOR")[] } });
  const execution = validValues(filters.execution, ["EXECUTED", "NOT_EXECUTED"] as const);
  if (execution.length) and.push({ executionStatus: { in: execution as ("EXECUTED" | "NOT_EXECUTED")[] } });
  const effectiveness = validValues(filters.effectiveness, ["PENDING", "ACCEPTABLE", "NOT_ACCEPTABLE", "NOT_APPLICABLE"] as const);
  if (effectiveness.length) and.push({ effectivenessStatus: { in: effectiveness as ("PENDING" | "ACCEPTABLE" | "NOT_ACCEPTABLE" | "NOT_APPLICABLE")[] } });
  const statuses = validValues(filters.status, ["DRAFT", "OPEN", "CLOSED"] as const);
  if (statuses.length) and.push({ finalStatus: { in: statuses as ("DRAFT" | "OPEN" | "CLOSED")[] } });

  const where: Prisma.ChangeControlWhereInput = and.length ? { AND: and } : {};
  const administrativeWhere: Prisma.ChangeControlWhereInput =
    filters.administrative === "ANNULLED"
      ? { qmsRecord: { isActive: false } }
      : filters.administrative === "ALL"
        ? {}
        : { qmsRecord: { isActive: true } };
  const pagination = qmsListPagination(await prisma.changeControl.count({ where }), filters.page);
  const now = new Date();
  const [rows, departments, years, total, drafts, open, executedPendingEfficacy, overdue] =
    await Promise.all([
      prisma.changeControl.findMany({
        where,
        select: {
          departmentId: true,
          id: true, qmsRecordId: true, departmentCodeSnapshot: true, description: true,
          justification: true, requesterName: true, requestDate: true, dictamenDate: true,
          classification: true, plannedImplementationDate: true, executionStatus: true, executionDate: true,
          effectivenessStatus: true, effectiveClosedAt: true, finalStatus: true,
          requestDecision: true, dictamenResult: true, internalObservations: true, dataQualityStatus: true,
          qmsRecord: { select: listRecordWithRelations },
          tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { description: true, plannedDate: true } },
          followups: { orderBy: [{ sequenceNumber: "desc" }, { followupDate: "desc" }], take: 1,
            select: { sequenceNumber: true, followupDate: true, nextFollowupDate: true } },
        },
        orderBy: [{ finalStatus: "asc" }, { requestDate: "desc" }, { createdAt: "desc" }, { id: "asc" }],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
      prisma.qmsRecord.findMany({
        where: { recordType: QmsRecordType.CHANGE_CONTROL, year: { not: null } },
        select: { year: true },
        distinct: ["year"],
        orderBy: { year: "desc" },
      }),
      prisma.changeControl.count({ where: { AND: [administrativeWhere, { finalStatus: { not: "DRAFT" } }] } }),
      prisma.changeControl.count({ where: { AND: [administrativeWhere, { finalStatus: "DRAFT" }] } }),
      prisma.changeControl.count({ where: { AND: [administrativeWhere, { finalStatus: "OPEN" }] } }),
      prisma.changeControl.count({
        where: { AND: [administrativeWhere, { executionStatus: "EXECUTED", effectivenessStatus: "PENDING", finalStatus: "OPEN" }] },
      }),
      prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM "ChangeControl" c JOIN "QmsRecord" q ON q.id=c."qmsRecordId"
        WHERE c."finalStatus"='OPEN' ${listAdministrativeSql(filters.administrative)}
        AND (SELECT f."nextFollowupDate" FROM "ChangeControlFollowup" f WHERE f."changeControlId"=c.id
             ORDER BY f."sequenceNumber" DESC, f."followupDate" DESC LIMIT 1) <= ${now}`),
    ]);

  return {
    rows: await withActiveReviewCounts(rows),
    pagination,
    departments,
    years: years.map((row) => row.year).filter((value): value is number => value !== null),
    counters: {
      total,
      drafts,
      open,
      executedPendingEfficacy,
      overdue: overdue[0].count,
    },
  };
}

export async function getChangeControlDetail(id: string) {
  return prisma.changeControl.findUnique({
    where: { id },
    include: {
      qmsRecord: {
        include: {
          sourceRelations: { where: { isActive: true }, include: { targetRecord: true } },
          targetRelations: { where: { isActive: true }, include: { sourceRecord: true } },
          history: { orderBy: { changedAt: "desc" }, take: 100 },
          versions: {
            orderBy: { sequenceNumber: "asc" },
            include: {
              documents: {
                where: { kind: "SIGNED_PDF" },
                orderBy: { uploadedAt: "desc" },
                take: 1,
              },
            },
          },
          generatedDocuments: { where: { documentType: { not: "RECORD_EVIDENCE" } }, orderBy: { generatedAt: "desc" } },
        },
      },
      department: true,
      tasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          department: true,
          states: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { followup: true },
          },
        },
      },
      followups: {
        orderBy: [{ sequenceNumber: "desc" }, { followupDate: "desc" }],
        include: {
          taskStates: {
            include: { task: { include: { department: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      formVersion: true,
      annexIIITemplateVersion: true,
      annexIVTemplateVersion: true,
      annexVTemplateVersion: true,
    },
  });
}

export async function getChangeControlLookups() {
  const [departments, formVersions, templates] = await Promise.all([
    prisma.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.formVersion.findMany({
      where: { module: "CHANGE_CONTROL", isActive: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.templateVersion.findMany({
      where: { module: "CHANGE_CONTROL", isActive: true },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);
  return { departments, formVersions, templates };
}
