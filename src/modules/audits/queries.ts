import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validValues, validYears } from "@/lib/qms/list-filters";
import { auditTypeLabels, auditScenarioLabels, auditStatusLabels, auditModalityLabels, auditQualityLabels } from "./domain";

export type AuditListFilters = {
  q?: string; administrative?: string; year?: string[]; type?: string[]; scenario?: string[]; department?: string[]; status?: string[]; modality?: string[]; quality?: string[];
  plannedFrom?: string; plannedTo?: string; performedFrom?: string; performedTo?: string; page?: string;
};
export function auditListWhere(filters: AuditListFilters): Prisma.AuditWhereInput {
  const and: Prisma.AuditWhereInput[] = [];
  if (filters.administrative === "ANNULLED") and.push({ qmsRecord: { isActive: false } });
  else if (filters.administrative !== "ALL") and.push({ qmsRecord: { isActive: true } });
  const years = validYears(filters.year); if (years.length) and.push({ qmsRecord: { year: { in: years } } });
  for (const [key, values, labels] of [["auditType", filters.type, auditTypeLabels], ["scenario", filters.scenario, auditScenarioLabels], ["status", filters.status, auditStatusLabels], ["modality", filters.modality, auditModalityLabels], ["dataQualityStatus", filters.quality, auditQualityLabels]] as const) {
    const selected = validValues(values, Object.keys(labels)); if (selected.length) and.push({ [key]: { in: selected } } as Prisma.AuditWhereInput);
  }
  if (filters.department?.length) and.push({ departments: { some: { isActive: true, departmentId: { in: filters.department } } } });
  const day = (v?: string) => v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v ? new Date(v) : undefined;
  for (const [key, from, to] of [["plannedDate", filters.plannedFrom, filters.plannedTo], ["performedDate", filters.performedFrom, filters.performedTo]] as const) {
    const gte = day(from), lte = day(to); if (gte || lte) and.push({ [key]: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } });
  }
  const q = filters.q?.trim().slice(0, 500);
  if (q) {
    const contains = { contains: q, mode: "insensitive" as const };
    and.push({ OR: [
      { qmsRecord: { businessCode: contains } }, { qmsRecord: { annulledBusinessCode: contains } },
      ...["title", "scope", "referenceText", "externalReference", "auditedEntityName", "auditingEntityName", "entityCode"].map(key => ({ [key]: contains })),
      { participants: { some: { isActive: true, OR: [{ displayName: contains }, { organization: contains }, { position: contains }] } } },
      { departments: { some: { isActive: true, OR: [{ departmentCodeSnapshot: contains }, { departmentNameSnapshot: contains }] } } },
    ] });
  }
  return { AND: and };
}
export async function getAuditList(filters: AuditListFilters) {
  const where = auditListWhere(filters), pageSize = 25;
  return prisma.$transaction(async tx => {
    const total = await tx.audit.count({ where });
    const page = Math.min(Math.max(1, Number(filters.page) || 1), Math.max(1, Math.ceil(total / pageSize)));
    const [rows, departments, years] = await Promise.all([
      tx.audit.findMany({ where, include: { qmsRecord: true, departments: { where: { isActive: true } }, participants: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (Math.floor(page) - 1) * pageSize, take: pageSize }),
      tx.department.findMany({ orderBy: { code: "asc" } }),
      tx.qmsRecord.findMany({ where: { recordType: "AUDIT", year: { not: null } }, distinct: ["year"], select: { year: true }, orderBy: { year: "desc" } }),
    ]);
    return { rows, departments, years: years.flatMap(r => r.year === null ? [] : [r.year]), total, page: Math.floor(page), pages: Math.max(1, Math.ceil(total / pageSize)) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function getAuditDetail(id: string) {
  return prisma.audit.findUnique({ where: { id }, include: { qmsRecord: { include: { history: { orderBy: [{ changedAt: "desc" }, { id: "desc" }] } } }, departments: true, participants: true } });
}
export async function getAuditDepartments() { return prisma.department.findMany({ orderBy: { code: "asc" } }); }
