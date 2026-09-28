import "server-only";
import { Prisma, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";

export type DeviationListFilters = {
  q?: string;
  year?: string;
  department?: string;
  status?: string;
  classification?: string;
  provenance?: string;
  measures?: string;
  capa?: string;
  deadline?: string;
};

export async function getDeviationList(filters: DeviationListFilters) {
  const and: Prisma.DeviationWhereInput[] = [];

  if (filters.q) {
    and.push({
      OR: [
        { qmsRecord: { businessCode: { contains: filters.q, mode: "insensitive" } } },
        { materialProcessAffected: { contains: filters.q, mode: "insensitive" } },
        { provenance: { contains: filters.q, mode: "insensitive" } },
        { whatHappened: { contains: filters.q, mode: "insensitive" } },
        { rootCause: { contains: filters.q, mode: "insensitive" } },
        { internalObservations: { contains: filters.q, mode: "insensitive" } },
        { capaPlans: { some: { description: { contains: filters.q, mode: "insensitive" } } } },
      ],
    });
  }

  if (filters.year && /^\d{4}$/.test(filters.year)) {
    and.push({ qmsRecord: { year: Number(filters.year) } });
  }
  if (filters.department) and.push({ departmentId: filters.department });
  if (filters.status === "OPEN" || filters.status === "CLOSED") and.push({ status: filters.status });
  if (["CRITICAL", "MAJOR", "MINOR"].includes(filters.classification ?? "")) {
    and.push({ classification: filters.classification as "CRITICAL" | "MAJOR" | "MINOR" });
  }
  if (filters.provenance) and.push({ provenance: filters.provenance });
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

  const [rows, departments, yearRows, provenanceRows, total, open, overdue, followupDue] =
    await Promise.all([
      prisma.deviation.findMany({
        where,
        include: {
          qmsRecord: {
            include: {
              sourceRelations: {
                where: { isActive: true },
                include: {
                  targetRecord: {
                    include: {
                      deviation: { select: { id: true } },
                      capa: { select: { id: true } },
                      changeControl: { select: { id: true } },
                      complaint: { select: { id: true } },
                      returnRecord: { select: { id: true } },
                    },
                  },
                },
              },
              targetRelations: {
                where: { isActive: true },
                include: {
                  sourceRecord: {
                    include: {
                      deviation: { select: { id: true } },
                      capa: { select: { id: true } },
                      changeControl: { select: { id: true } },
                      complaint: { select: { id: true } },
                      returnRecord: { select: { id: true } },
                    },
                  },
                },
              },
            },
          },
          department: true,
          immediateActions: true,
          capaPlans: true,
        },
        orderBy: [{ status: "asc" }, { issueDate: "desc" }, { createdAt: "desc" }],
        take: 300,
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
      prisma.deviation.count(),
      prisma.deviation.count({ where: { status: "OPEN" } }),
      prisma.deviation.count({ where: { status: "OPEN", deadlineStatus: "OUT_OF_TIME" } }),
      prisma.deviation.findMany({
        where: { status: "OPEN" },
        select: {
          followups: {
            orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: { nextFollowupDate: true },
          },
        },
      }),
    ]);

  return {
    rows,
    departments,
    years: yearRows.map((row) => row.year).filter((value): value is number => value !== null),
    provenances: provenanceRows
      .map((row) => row.provenance)
      .filter((value): value is string => Boolean(value)),
    counters: {
      total,
      open,
      overdue,
      followupDue: followupDue.filter((row) => {
        const nextDate = row.followups[0]?.nextFollowupDate;
        return Boolean(nextDate && nextDate <= new Date());
      }).length,
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
          versions: { orderBy: { sequenceNumber: "asc" } },
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
