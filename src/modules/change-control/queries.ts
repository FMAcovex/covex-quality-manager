import "server-only";
import { Prisma, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ChangeControlListFilters = {
  q?: string;
  year?: string;
  department?: string;
  classification?: string;
  execution?: string;
  effectiveness?: string;
  status?: string;
};

export async function getChangeControlList(filters: ChangeControlListFilters) {
  const and: Prisma.ChangeControlWhereInput[] = [];
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
  if (filters.year && /^\d{4}$/.test(filters.year)) {
    and.push({ qmsRecord: { year: Number(filters.year) } });
  }
  if (filters.department) and.push({ departmentId: filters.department });
  if (filters.classification === "MAJOR" || filters.classification === "MINOR") {
    and.push({ classification: filters.classification });
  }
  if (filters.execution === "EXECUTED" || filters.execution === "NOT_EXECUTED") {
    and.push({ executionStatus: filters.execution });
  }
  if (["PENDING", "ACCEPTABLE", "NOT_ACCEPTABLE"].includes(filters.effectiveness ?? "")) {
    and.push({ effectivenessStatus: filters.effectiveness as "PENDING" | "ACCEPTABLE" | "NOT_ACCEPTABLE" });
  }
  if (filters.status === "OPEN" || filters.status === "CLOSED") {
    and.push({ finalStatus: filters.status });
  }

  const where: Prisma.ChangeControlWhereInput = and.length ? { AND: and } : {};
  const [rows, departments, years, total, open, executedPendingEfficacy, overdue] =
    await Promise.all([
      prisma.changeControl.findMany({
        where,
        include: {
          qmsRecord: true,
          department: true,
          tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          followups: { orderBy: [{ sequenceNumber: "desc" }, { followupDate: "desc" }] },
        },
        orderBy: [{ finalStatus: "asc" }, { requestDate: "desc" }, { createdAt: "desc" }],
        take: 300,
      }),
      prisma.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
      prisma.qmsRecord.findMany({
        where: { recordType: QmsRecordType.CHANGE_CONTROL, year: { not: null } },
        select: { year: true },
        distinct: ["year"],
        orderBy: { year: "desc" },
      }),
      prisma.changeControl.count(),
      prisma.changeControl.count({ where: { finalStatus: "OPEN" } }),
      prisma.changeControl.count({
        where: { executionStatus: "EXECUTED", effectivenessStatus: "PENDING", finalStatus: "OPEN" },
      }),
      prisma.changeControl.findMany({
        where: { finalStatus: "OPEN" },
        select: {
          followups: {
            orderBy: [{ sequenceNumber: "desc" }, { followupDate: "desc" }],
            take: 1,
            select: { nextFollowupDate: true },
          },
        },
      }),
    ]);

  const now = new Date();
  return {
    rows,
    departments,
    years: years.map((row) => row.year).filter((value): value is number => value !== null),
    counters: {
      total,
      open,
      executedPendingEfficacy,
      overdue: overdue.filter((row) => {
        const date = row.followups[0]?.nextFollowupDate;
        return Boolean(date && date <= now);
      }).length,
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
          versions: { orderBy: { sequenceNumber: "asc" } },
          generatedDocuments: { orderBy: { generatedAt: "desc" } },
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
