import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { DeviationListFilters } from "@/modules/deviations/queries";
import { validValues, validYears } from "@/lib/qms/list-filters";

export function buildDeviationWhere(filters: DeviationListFilters): Prisma.DeviationWhereInput {
  const and: Prisma.DeviationWhereInput[] = [];
  if (filters.administrative === "ANNULLED") and.push({ qmsRecord: { isActive: false } });
  else if (filters.administrative !== "ALL") and.push({ qmsRecord: { isActive: true } });
  if (filters.q) and.push({ OR: [
    { qmsRecord: { businessCode: { contains: filters.q, mode: "insensitive" } } },
    { materialProcessAffected: { contains: filters.q, mode: "insensitive" } },
    { provenance: { contains: filters.q, mode: "insensitive" } },
    { whatHappened: { contains: filters.q, mode: "insensitive" } },
    { rootCause: { contains: filters.q, mode: "insensitive" } },
    { internalObservations: { contains: filters.q, mode: "insensitive" } },
    { capaPlans: { some: { description: { contains: filters.q, mode: "insensitive" } } } },
  ]});
  const years = validYears(filters.year); if (years.length) and.push({ qmsRecord: { year: { in: years } } });
  if (filters.department?.length) and.push({ departmentId: { in: filters.department } });
  const requestedStatuses = validValues(filters.status, ["DRAFT","OPEN","CLOSED"] as const);
  const statuses = requestedStatuses.filter((value) => value !== "DRAFT") as ("OPEN"|"CLOSED")[];
  if (filters.status?.length) and.push({ status: { in: statuses } });
  else and.push({ status: { not: "DRAFT" } });
  const classifications = validValues(filters.classification, ["CRITICAL","MAJOR","MINOR"] as const);
  if (classifications.length) and.push({ classification: { in: classifications as ("CRITICAL"|"MAJOR"|"MINOR")[] } });
  if (filters.provenance?.length) and.push({ provenance: { in: filters.provenance } });
  if (["NOT_EVALUATED","IN_TIME","OUT_OF_TIME","NA"].includes(filters.deadline ?? "")) and.push({ deadlineStatus: filters.deadline as "NOT_EVALUATED"|"IN_TIME"|"OUT_OF_TIME"|"NA" });
  if (filters.capa === "yes") and.push({ capaPlans: { some: {} } });
  if (filters.capa === "no") and.push({ capaPlans: { none: {} } });
  if (filters.measures === "none") and.push({ immediateActions: { none: {} }, capaPlans: { none: {} } });
  if (filters.measures === "immediate") and.push({ immediateActions: { some: {} }, capaPlans: { none: {} } });
  if (filters.measures === "capa") and.push({ immediateActions: { none: {} }, capaPlans: { some: {} } });
  if (filters.measures === "both") and.push({ immediateActions: { some: {} }, capaPlans: { some: {} } });
  return and.length ? { AND: and } : {};
}

export function getDeviationExportRows(filters: DeviationListFilters) {
  return prisma.deviation.findMany({
    where: buildDeviationWhere(filters),
    include: {
      qmsRecord: true,
      immediateActions: true,
      capaPlans: { include: { linkedCapaRecord: true } },
    },
    orderBy: [{ issueDate: "asc" }, { createdAt: "asc" }],
  });
}
