import "server-only";
import { Prisma, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";

export type CapaListFilters = {
  q?: string;
  year?: string;
  department?: string;
  type?: string;
  status?: string;
  effectiveness?: string;
  origin?: string;
  followup?: string;
};

export async function getCapaList(filters: CapaListFilters) {
  const and: Prisma.CapaWhereInput[] = [];

  if (filters.q) {
    and.push({
      OR: [
        { qmsRecord: { businessCode: { contains: filters.q, mode: "insensitive" } } },
        { originCode: { contains: filters.q, mode: "insensitive" } },
        { originType: { contains: filters.q, mode: "insensitive" } },
        { defectDescription: { contains: filters.q, mode: "insensitive" } },
        { rootCause: { contains: filters.q, mode: "insensitive" } },
        { internalObservations: { contains: filters.q, mode: "insensitive" } },
        { plannedActions: { some: { description: { contains: filters.q, mode: "insensitive" } } } },
      ],
    });
  }
  if (filters.year && /^\d{4}$/.test(filters.year)) {
    and.push({ qmsRecord: { year: Number(filters.year) } });
  }
  if (filters.department) and.push({ departmentId: filters.department });
  if (filters.type === "CORRECTIVE" || filters.type === "PREVENTIVE") {
    and.push({ actionType: filters.type });
  }
  if (["OPEN", "CLOSED", "CANCELLED"].includes(filters.status ?? "")) {
    and.push({ status: filters.status as "OPEN" | "CLOSED" | "CANCELLED" });
  }
  if (["CONFORMING", "NONCONFORMING", "PENDING", "NA"].includes(filters.effectiveness ?? "")) {
    and.push({
      effectivenessStatus: filters.effectiveness as "CONFORMING" | "NONCONFORMING" | "PENDING" | "NA",
    });
  }
  if (filters.origin) and.push({ originType: filters.origin });

  const where: Prisma.CapaWhereInput = and.length ? { AND: and } : {};
  const now = new Date();

  const [rows, departments, years, origins, total, open, pendingEfficacy, overdueFollowups] =
    await Promise.all([
      prisma.capa.findMany({
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
          plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          followups: { orderBy: [{ followupDate: "desc" }, { sequenceNumber: "desc" }] },
        },
        orderBy: [{ status: "asc" }, { openedAt: "desc" }, { createdAt: "desc" }],
        take: 300,
      }),
      prisma.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
      prisma.qmsRecord.findMany({
        where: { recordType: QmsRecordType.CAPA, year: { not: null } },
        select: { year: true },
        distinct: ["year"],
        orderBy: { year: "desc" },
      }),
      prisma.capa.findMany({
        where: { originType: { not: null } },
        select: { originType: true },
        distinct: ["originType"],
        orderBy: { originType: "asc" },
      }),
      prisma.capa.count(),
      prisma.capa.count({ where: { status: "OPEN" } }),
      prisma.capa.count({
        where: {
          status: "CLOSED",
          effectivenessStatus: "PENDING",
          effectiveClosedAt: null,
        },
      }),
      prisma.capa.findMany({
        where: { status: "OPEN" },
        select: {
          followups: {
            orderBy: [{ followupDate: "desc" }, { sequenceNumber: "desc" }],
            take: 1,
            select: { nextFollowupDate: true },
          },
        },
      }),
    ]);

  return {
    rows: rows.filter((row) => {
      if (!filters.followup) return true;
      const next = row.followups[0]?.nextFollowupDate;
      if (filters.followup === "due") return Boolean(next && next <= now);
      if (filters.followup === "scheduled") return Boolean(next && next > now);
      if (filters.followup === "none") return !next;
      return true;
    }),
    departments,
    years: years.map((row) => row.year).filter((value): value is number => value !== null),
    origins: origins.map((row) => row.originType).filter((value): value is string => Boolean(value)),
    counters: {
      total,
      open,
      pendingEfficacy,
      overdueFollowups: overdueFollowups.filter((row) => {
        const next = row.followups[0]?.nextFollowupDate;
        return Boolean(next && next <= now);
      }).length,
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
            include: { targetRecord: { include: { deviation: { select: { id: true } }, capa: { select: { id: true } }, changeControl: { select: { id: true } }, complaint: { select: { id: true } }, returnRecord: { select: { id: true } } } } },
          },
          targetRelations: {
            where: { isActive: true },
            include: { sourceRecord: { include: { deviation: { select: { id: true } }, capa: { select: { id: true } }, changeControl: { select: { id: true } }, complaint: { select: { id: true } }, returnRecord: { select: { id: true } } } } },
          },
          history: { orderBy: { changedAt: "desc" }, take: 100 },
          versions: { orderBy: { sequenceNumber: "asc" } },
          generatedDocuments: { orderBy: { generatedAt: "desc" } },
        },
      },
      department: true,
      plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
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
