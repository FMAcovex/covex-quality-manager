import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { DeviationListFilters } from "@/modules/deviations/queries";

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
  if (filters.year && /^\d{4}$/.test(filters.year)) and.push({ qmsRecord: { year: Number(filters.year) } });
  if (filters.department) and.push({ departmentId: filters.department });
  if (filters.status === "DRAFT" || filters.status === "OPEN" || filters.status === "CLOSED") {
    and.push({ status: filters.status });
  } else {
    and.push({ status: { not: "DRAFT" } });
  }
  if (["CRITICAL","MAJOR","MINOR"].includes(filters.classification ?? "")) and.push({ classification: filters.classification as "CRITICAL"|"MAJOR"|"MINOR" });
  if (filters.provenance) and.push({ provenance: filters.provenance });
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
