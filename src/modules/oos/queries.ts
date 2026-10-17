import "server-only";
import { Prisma, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validValues, validYears } from "@/lib/qms/list-filters";

export type OosListFilters = {
  page?: string;
  q?: string;
  administrative?: string;
  year?: string[];
  area?: string[];
  status?: string[];
  phase?: string;
  result?: string[];
};

const pageSize = 25;

// Sin disposición o con error de laboratorio; `NOT` excluiría las disposiciones nulas en SQL.
const phaseIWhere: Prisma.OosRecordWhereInput = { OR: [{ phaseIDisposition: null }, { phaseIDisposition: "LAB_ERROR" }] };

export async function getOosList(filters: OosListFilters) {
  const where = oosListWhere(filters);
  const count = await prisma.oosRecord.count({ where });
  const requestedPage = Number(filters.page) || 1;
  const page = Math.min(Math.max(1, Math.trunc(requestedPage)), Math.max(1, Math.ceil(count / pageSize)));
  const active: Prisma.OosRecordWhereInput = administrativeWhere(filters.administrative);
  const [rows, years, operational, drafts, phaseI, phaseII, closed] = await Promise.all([
    prisma.oosRecord.findMany({
      where,
      include: { qmsRecord: true },
      orderBy: [{ status: "asc" }, { issueDate: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.qmsRecord.findMany({ where: { recordType: QmsRecordType.OOS, year: { not: null } }, select: { year: true }, distinct: ["year"], orderBy: { year: "desc" } }),
    prisma.oosRecord.count({ where: { AND: [active, { status: { not: "DRAFT" } }] } }),
    prisma.oosRecord.count({ where: { AND: [active, { status: "DRAFT" }] } }),
    prisma.oosRecord.count({ where: { AND: [active, { status: "OPEN" }, phaseIWhere] } }),
    prisma.oosRecord.count({ where: { AND: [active, { status: "OPEN", phaseIDisposition: "FULL_SCALE" }] } }),
    prisma.oosRecord.count({ where: { AND: [active, { status: "CLOSED" }] } }),
  ]);
  return {
    rows,
    page,
    pageSize,
    count,
    years: years.map((row) => row.year).filter((year): year is number => year !== null),
    counters: { operational, drafts, phaseI, phaseII, closed },
  };
}

function administrativeWhere(value: string | undefined): Prisma.OosRecordWhereInput {
  if (value === "ANNULLED") return { qmsRecord: { isActive: false } };
  if (value === "ALL") return {};
  return { qmsRecord: { isActive: true } };
}

export function oosListWhere(filters: OosListFilters): Prisma.OosRecordWhereInput {
  const and: Prisma.OosRecordWhereInput[] = [administrativeWhere(filters.administrative)];
  const q = filters.q?.trim();
  if (q) {
    const contains = { contains: q, mode: "insensitive" as const };
    and.push({ OR: [
      { qmsRecord: { businessCode: contains } },
      { qmsRecord: { annulledBusinessCode: contains } },
      { materialName: contains },
      { lotNumber: contains },
      { supplier: contains },
      { detectionDescription: contains },
    ] });
  }
  const years = validYears(filters.year);
  if (years.length) and.push({ qmsRecord: { year: { in: years } } });
  const areas = validValues(filters.area, ["API", "MD"] as const);
  if (areas.length) and.push({ area: { in: areas as ("API" | "MD")[] } });
  const statuses = validValues(filters.status, ["DRAFT", "OPEN", "CLOSED"] as const);
  if (statuses.length) and.push({ status: { in: statuses as ("DRAFT" | "OPEN" | "CLOSED")[] } });
  if (filters.phase === "I") and.push(phaseIWhere);
  if (filters.phase === "II") and.push({ phaseIDisposition: "FULL_SCALE" });
  const results = validValues(filters.result, ["INVALIDATED", "CONFIRMED", "INCONCLUSIVE"] as const);
  if (results.length) and.push({ investigationResult: { in: results as ("INVALIDATED" | "CONFIRMED" | "INCONCLUSIVE")[] } });
  return { AND: and };
}

export function getOosDetail(id: string) {
  return prisma.oosRecord.findUnique({
    where: { id },
    include: {
      department: true,
      qmsRecord: { include: { history: { orderBy: { changedAt: "desc" }, take: 100 } } },
    },
  });
}

export function getOosDepartments() {
  return prisma.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
}
