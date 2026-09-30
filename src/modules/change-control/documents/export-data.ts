import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validValues, validYears } from "@/lib/qms/list-filters";

export type ChangeControlExportFilters = {
  q?: string;
  administrative?: string;
  year?: string[];
  department?: string[];
  classification?: string[];
  execution?: string[];
  effectiveness?: string[];
  status?: string[];
};

export async function getChangeControlExportRows(filters: ChangeControlExportFilters) {
  const and: Prisma.ChangeControlWhereInput[] = [];
  if (filters.administrative === "ANNULLED") and.push({ qmsRecord: { isActive: false } });
  else if (filters.administrative !== "ALL") and.push({ qmsRecord: { isActive: true } });
  and.push({ finalStatus: { not: "DRAFT" } });
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
  const years = validYears(filters.year); if (years.length) and.push({ qmsRecord: { year: { in: years } } });
  if (filters.department?.length) and.push({ departmentId: { in: filters.department } });
  const classifications = validValues(filters.classification, ["MAJOR","MINOR"] as const); if (classifications.length) and.push({ classification: { in: classifications as ("MAJOR"|"MINOR")[] } });
  const execution = validValues(filters.execution, ["EXECUTED","NOT_EXECUTED"] as const); if (execution.length) and.push({ executionStatus: { in: execution as ("EXECUTED"|"NOT_EXECUTED")[] } });
  const effectiveness = validValues(filters.effectiveness, ["PENDING","ACCEPTABLE","NOT_ACCEPTABLE","NOT_APPLICABLE"] as const); if (effectiveness.length) and.push({ effectivenessStatus: { in: effectiveness as ("PENDING"|"ACCEPTABLE"|"NOT_ACCEPTABLE"|"NOT_APPLICABLE")[] } });
  const statuses = validValues(filters.status, ["OPEN","CLOSED"] as const); if (statuses.length) and.push({ finalStatus: { in: statuses as ("OPEN"|"CLOSED")[] } });

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
