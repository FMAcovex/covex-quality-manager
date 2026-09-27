import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type CapaExportFilters = {
  year?: string;
  department?: string;
  type?: string;
  status?: string;
  effectiveness?: string;
  origin?: string;
};

export async function getCapaExportRows(filters: CapaExportFilters) {
  const and: Prisma.CapaWhereInput[] = [];
  if (filters.year && /^\d{4}$/.test(filters.year)) {
    and.push({ qmsRecord: { year: Number(filters.year) } });
  }
  if (filters.department) and.push({ departmentId: filters.department });
  if (filters.type === "CORRECTIVE" || filters.type === "PREVENTIVE") {
    and.push({ actionType: filters.type });
  }
  if (["OPEN","CLOSED","CANCELLED"].includes(filters.status ?? "")) {
    and.push({ status: filters.status as "OPEN"|"CLOSED"|"CANCELLED" });
  }
  if (["CONFORMING","NONCONFORMING","PENDING"].includes(filters.effectiveness ?? "")) {
    and.push({
      effectivenessStatus: filters.effectiveness as "CONFORMING"|"NONCONFORMING"|"PENDING",
    });
  }
  if (filters.origin) and.push({ originType: filters.origin });

  return prisma.capa.findMany({
    where: and.length ? { AND: and } : {},
    include: {
      qmsRecord: true,
      plannedActions: { orderBy: [{ sortOrder:"asc" },{ createdAt:"asc" }] },
    },
    orderBy: [{ openedAt:"asc" },{ createdAt:"asc" }],
  });
}
