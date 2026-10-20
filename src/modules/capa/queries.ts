import { reviewListWhere } from "@/lib/qms/review/list-domain";
import { withActiveReviewCounts } from "@/lib/qms/review/list-queries";
import "server-only";
import { Prisma, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assignedListWhere, assignedWhere } from "@/lib/qms/assigned";
import { currentIdentity } from "@/lib/auth/context";
import { responsibleUserSelect } from "@/lib/qms/responsible-user";
import { validValues, validYears } from "@/lib/qms/list-filters";
import { qmsListPagination } from "@/lib/qms/list-pagination";
import { listRecordWithRelations } from "@/lib/qms/list-projections";

export type CapaListFilters = {
  assigned?: string;
  page?: string;
  review?: string;
  q?: string;
  administrative?: string;
  year?: string[];
  department?: string[];
  type?: string[];
  status?: string[];
  effectiveness?: string[];
  origin?: string[];
  followup?: string;
};

export async function getCapaList(filters: CapaListFilters) {
  const and: Prisma.CapaWhereInput[] = [];
  const reviewWhere = reviewListWhere(filters.review);
  if (reviewWhere) and.push({ qmsRecord: reviewWhere });
  const assigned = assignedListWhere(filters.assigned, currentIdentity()?.principal.id, assignedWhere.capa);
  if (assigned) and.push(assigned);

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
        { originCode: { contains: filters.q, mode: "insensitive" } },
        { originType: { contains: filters.q, mode: "insensitive" } },
        { defectDescription: { contains: filters.q, mode: "insensitive" } },
        { rootCause: { contains: filters.q, mode: "insensitive" } },
        { internalObservations: { contains: filters.q, mode: "insensitive" } },
        { plannedActions: { some: { description: { contains: filters.q, mode: "insensitive" } } } },
        { actionFollowups: { some: { description: { contains: filters.q, mode: "insensitive" } } } },
        { qmsRecord: { targetRelations: { some: { isActive: true, sourceRecord: { businessCode: { contains: filters.q, mode: "insensitive" } } } } } },
      ],
    });
  }
  const yearsFilter = validYears(filters.year);
  if (yearsFilter.length) and.push({ qmsRecord: { year: { in: yearsFilter } } });
  if (filters.department?.length) and.push({ departmentId: { in: filters.department } });
  const types = validValues(filters.type, ["CORRECTIVE", "PREVENTIVE"] as const);
  if (types.length) and.push({ actionType: { in: types as ("CORRECTIVE" | "PREVENTIVE")[] } });
  const statuses = validValues(filters.status, ["DRAFT", "OPEN", "CLOSED", "CANCELLED"] as const);
  if (statuses.length) and.push({ status: { in: statuses as ("DRAFT" | "OPEN" | "CLOSED" | "CANCELLED")[] } });
  const effectiveness = validValues(filters.effectiveness, ["CONFORMING", "NONCONFORMING", "PENDING", "NA"] as const);
  if (effectiveness.length) and.push({ effectivenessStatus: { in: effectiveness as ("CONFORMING" | "NONCONFORMING" | "PENDING" | "NA")[] } });
  if (filters.origin?.length) {
    const relationTypes = filters.origin
      .map((value) => value === "Desviación" ? QmsRecordType.DEVIATION : value === "Reclamación" ? QmsRecordType.COMPLAINT : value === "Auditoría" ? QmsRecordType.AUDIT : null)
      .filter((value): value is "DEVIATION" | "COMPLAINT" | "AUDIT" => value !== null);
    if (relationTypes.length) {
      and.push({
        qmsRecord: {
          targetRelations: {
            some: {
              isActive: true,
              relationType: "GENERATES",
              sourceRecord: { recordType: { in: relationTypes } },
            },
          },
        },
      });
    }
  }

  const now = new Date();
  if (filters.followup === "due") and.push({ nextFollowupDate: { lte: now } });
  if (filters.followup === "scheduled") and.push({ nextFollowupDate: { gt: now } });
  if (filters.followup === "none") and.push({ nextFollowupDate: null });
  const where: Prisma.CapaWhereInput = and.length ? { AND: and } : {};
  // D-117 (H-15): los contadores son totales del módulo; nunca cuentan anulados, sea cual sea el filtro.
  const counterWhere: Prisma.CapaWhereInput = { qmsRecord: { isActive: true } };

  const pagination = qmsListPagination(await prisma.capa.count({ where }), filters.page);
  const [rows, departments, years, origins, total, drafts, open, pendingEfficacy, overdueFollowups] =
    await Promise.all([
      prisma.capa.findMany({
        where,
        select: {
          departmentId: true,
          id: true, qmsRecordId: true, departmentCodeSnapshot: true, actionType: true,
          status: true, effectivenessStatus: true, defectDescription: true, rootCause: true,
          originCode: true, originType: true, openedAt: true, operationalClosedAt: true,
          nextFollowupDate: true, effectiveClosedAt: true, internalObservations: true, dataQualityStatus: true,
          qmsRecord: {
            select: {
              ...listRecordWithRelations,
              versions: { orderBy: { sequenceNumber: "desc" }, take: 1, select: { sequenceNumber: true } },
            },
          },
          plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { description: true, plannedExecutionDate: true } },
        },
        orderBy: [{ status: "asc" }, { openedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
      prisma.qmsRecord.findMany({
        where: { recordType: QmsRecordType.CAPA, year: { not: null } },
        select: { year: true },
        distinct: ["year"],
        orderBy: { year: "desc" },
      }),
      Promise.resolve([{ originType: "Desviación" }, { originType: "Reclamación" }, { originType: "Auditoría" }]),
      prisma.capa.count({ where: { AND: [counterWhere, { status: { not: "DRAFT" } }] } }),
      prisma.capa.count({ where: { AND: [counterWhere, { status: "DRAFT" }] } }),
      prisma.capa.count({ where: { AND: [counterWhere, { status: "OPEN" }] } }),
      prisma.capa.count({
        where: {
          AND: [
            counterWhere,
            { status: "CLOSED", effectivenessStatus: "PENDING", effectiveClosedAt: null },
          ],
        },
      }),
      prisma.capa.count({
        where: { AND: [counterWhere, { status: "OPEN", nextFollowupDate: { lte: now } }] },
      }),
    ]);

  return {
    rows: await withActiveReviewCounts(rows),
    pagination,
    departments,
    years: years.map((row) => row.year).filter((value): value is number => value !== null),
    origins: origins.map((row) => row.originType).filter((value): value is string => Boolean(value)),
    counters: {
      total,
      drafts,
      open,
      pendingEfficacy,
      overdueFollowups,
    },
  };
}

export async function getCapaDetail(id: string) {
  return prisma.capa.findUnique({
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
          generatedDocuments: { where: { documentType: { not: "RECORD_EVIDENCE" } }, orderBy: { generatedAt: "desc" } },
        },
      },
      department: true,
      plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { responsibleUser: responsibleUserSelect } },
      actionFollowups: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: { orderBy: [{ followupDate: "desc" }, { sequenceNumber: "desc" }] },
      formVersion: true,
      annexIIITemplateVersion: true,
    },
  });
}

export async function getCapaLookups() {
  const [departments, formVersions, templates] = await Promise.all([
    prisma.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.formVersion.findMany({
      where: { module: "CAPA", isActive: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.templateVersion.findMany({
      where: { module: "CAPA", documentType: "CAPA_ANNEX_III", isActive: true },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);
  return { departments, formVersions, templates };
}

export async function getDeviationPlanPrefill(planId: string) {
  return prisma.deviationCapaPlan.findUnique({
    where: { id: planId },
    include: {
      deviation: {
        include: {
          qmsRecord: true,
          department: true,
        },
      },
    },
  });
}


export async function getComplaintPlanPrefill(planId: string) {
  return prisma.complaintCapaPlan.findUnique({
    where: { id: planId },
    include: {
      complaint: {
        include: {
          qmsRecord: true,
          department: true,
        },
      },
    },
  });
}


export async function getComplaintPrefill(complaintId: string) {
  return prisma.complaint.findUnique({
    where: { id: complaintId },
    include: {
      qmsRecord: true,
      department: true,
    },
  });
}


export async function getCapaOriginRecords(ids: string[]) {
  if (!ids.length) return [];
  return prisma.qmsRecord.findMany({
    where: {
      id: { in: ids },
      isActive: true,
      recordType: { in: [QmsRecordType.DEVIATION, QmsRecordType.COMPLAINT, QmsRecordType.AUDIT] },
    },
    select: { id: true, recordType: true, businessCode: true, year: true },
    orderBy: { businessCode: "asc" },
  });
}
