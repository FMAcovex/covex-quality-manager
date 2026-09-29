import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ChangeControlExportFilters = {
  q?: string;
  administrative?: string;
  year?: string;
  department?: string;
  classification?: string;
  execution?: string;
  effectiveness?: string;
  status?: string;
};

export async function getChangeControlExportRows(filters: ChangeControlExportFilters) {
  const and: Prisma.ChangeControlWhereInput[] = [];
  if (filters.administrative === "ANNULLED") and.push({ qmsRecord: { isActive: false } });
  else if (filters.administrative !== "ALL") and.push({ qmsRecord: { isActive: true } });
  if (filters.q) {
    and.push({
      OR: [
        { qmsRecord: { businessCode: { contains: filters.q, mode: "insensitive" } } },
        { description: { contains: filters.q, mode: "insensitive" } },
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
  if (["PENDING", "ACCEPTABLE", "NOT_ACCEPTABLE", "NOT_APPLICABLE"].includes(filters.effectiveness ?? "")) {
    and.push({
      effectivenessStatus: filters.effectiveness as
        | "PENDING"
        | "ACCEPTABLE"
        | "NOT_ACCEPTABLE"
        | "NOT_APPLICABLE",
    });
  }
  if (filters.status === "OPEN" || filters.status === "CLOSED") {
    and.push({ finalStatus: filters.status });
  }

  return prisma.changeControl.findMany({
    where: and.length ? { AND: and } : {},
    include: {
      qmsRecord: true,
      tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: { orderBy: [{ sequenceNumber: "desc" }, { followupDate: "desc" }] },
    },
    orderBy: [{ requestDate: "asc" }, { createdAt: "asc" }],
  });
}
