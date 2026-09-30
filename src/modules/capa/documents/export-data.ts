import "server-only";
import { Prisma, QmsRecordType } from "@prisma/client";
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
  const requestedStatuses = validValues(filters.status, ["DRAFT","OPEN","CLOSED","CANCELLED"] as const);
  const statuses = requestedStatuses.filter((value) => value !== "DRAFT") as ("OPEN"|"CLOSED"|"CANCELLED")[];
  if (filters.status?.length) and.push({ status: { in: statuses } });
  const effectiveness = validValues(filters.effectiveness, ["CONFORMING","NONCONFORMING","PENDING"] as const); if (effectiveness.length) and.push({ effectivenessStatus: { in: effectiveness as ("CONFORMING"|"NONCONFORMING"|"PENDING")[] } });
  if (filters.origin?.length) {
    const relationTypes = filters.origin
      .map((value) => value === "Desviación" ? QmsRecordType.DEVIATION : value === "Reclamación" ? QmsRecordType.COMPLAINT : null)
      .filter((value): value is QmsRecordType => Boolean(value));
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

  return prisma.capa.findMany({
    where: and.length ? { AND: and } : {},
    include: {
      qmsRecord: true,
      plannedActions: { orderBy: [{ sortOrder:"asc" },{ createdAt:"asc" }] },
      actionFollowups: { orderBy: [{ sortOrder:"asc" },{ createdAt:"asc" }] },
      followups: { orderBy: [{ followupDate:"desc" },{ sequenceNumber:"desc" }] },
    },
    orderBy: [{ openedAt:"asc" },{ createdAt:"asc" }],
  });
}
