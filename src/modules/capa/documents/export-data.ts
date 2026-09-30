import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validValues, validYears } from "@/lib/qms/list-filters";

export type CapaExportFilters = {
  administrative?: string;
  year?: string[];
  department?: string[];
  type?: string[];
  status?: string[];
  effectiveness?: string[];
  origin?: string[];
};

export async function getCapaExportRows(filters: CapaExportFilters) {
  const and: Prisma.CapaWhereInput[] = [];
  if (filters.administrative === "ANNULLED") and.push({ qmsRecord: { isActive: false } });
  else if (filters.administrative !== "ALL") and.push({ qmsRecord: { isActive: true } });
  and.push({ status: { not: "DRAFT" } });
  const years = validYears(filters.year); if (years.length) and.push({ qmsRecord: { year: { in: years } } });
  if (filters.department?.length) and.push({ departmentId: { in: filters.department } });
  const types = validValues(filters.type, ["CORRECTIVE","PREVENTIVE"] as const); if (types.length) and.push({ actionType: { in: types as ("CORRECTIVE"|"PREVENTIVE")[] } });
  const statuses = validValues(filters.status, ["OPEN","CLOSED","CANCELLED"] as const); if (statuses.length) and.push({ status: { in: statuses as ("OPEN"|"CLOSED"|"CANCELLED")[] } });
  const effectiveness = validValues(filters.effectiveness, ["CONFORMING","NONCONFORMING","PENDING"] as const); if (effectiveness.length) and.push({ effectivenessStatus: { in: effectiveness as ("CONFORMING"|"NONCONFORMING"|"PENDING")[] } });
  if (filters.origin?.length) and.push({ originType: { in: filters.origin } });

  return prisma.capa.findMany({
    where: and.length ? { AND: and } : {},
    include: {
      qmsRecord: true,
      plannedActions: { orderBy: [{ sortOrder:"asc" },{ createdAt:"asc" }] },
      followups: { orderBy: [{ followupDate:"desc" },{ sequenceNumber:"desc" }] },
    },
    orderBy: [{ openedAt:"asc" },{ createdAt:"asc" }],
  });
}
