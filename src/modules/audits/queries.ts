import { reviewListWhere } from "@/lib/qms/review/list-domain";
import { withActiveReviewCounts } from "@/lib/qms/review/list-queries";
import { Prisma, type AuditFindingCriticality } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assignedListWhere, assignedWhere } from "@/lib/qms/assigned";
import { currentIdentity } from "@/lib/auth/context";
import { validValues, validYears } from "@/lib/qms/list-filters";
import { pendingActionStatuses } from "./finding-domain";
import { nextReviewRange } from "./list-date-filters";
import { auditTypeLabels, auditScenarioLabels, auditStatusLabels, auditModalityLabels, auditQualityLabels } from "./domain";

export type AuditListFilters = {
  review?: string; report?: string;
  /** «Asignadas a mí» (D-102): `assignedUserId` lo pone la consulta con el usuario de la sesión. */
  assigned?: string; assignedUserId?: string | null; signedPdf?: string; situation?: string;
  findings?: string; criticality?: string[]; pendingActions?: string; relatedDeviation?: string; relatedCapa?: string; nextReviewFrom?: string; nextReviewTo?: string;
  planning?: string; planId?: string;
  q?: string; administrative?: string; year?: string[]; type?: string[]; scenario?: string[]; department?: string[]; status?: string[]; modality?: string[]; quality?: string[];
  plannedFrom?: string; plannedTo?: string; performedFrom?: string; performedTo?: string; page?: string;
};
export function auditListWhere(filters: AuditListFilters): Prisma.AuditWhereInput {
  const and: Prisma.AuditWhereInput[] = [];
  if(filters.planning==="PLANNED"||filters.planning==="OUT_OF_PLAN"||filters.planning==="UNCLASSIFIED")and.push({planningStatus:filters.planning});
  if(filters.planId)and.push({planEntry:{planId:filters.planId}});
  if (filters.administrative === "ANNULLED") and.push({ qmsRecord: { isActive: false } });
  else if (filters.administrative !== "ALL") and.push({ qmsRecord: { isActive: true } });
  const review = reviewListWhere(filters.review); if (review) and.push({qmsRecord:review});
  const assigned = assignedListWhere(filters.assigned, filters.assignedUserId, assignedWhere.audit); if (assigned) and.push(assigned);
  const reportVersion = { versions: { some: { kind: { in: ["INITIAL", "AUDIT_REVISION"] as ("INITIAL"|"AUDIT_REVISION")[] } } } };
  if (filters.report === "issued") and.push({qmsRecord:reportVersion});
  // D-110 (R5D): cliente e inspección no tienen informe COVEX pendiente.
  const received: ("CLIENT"|"AUTHORITY")[] = ["CLIENT", "AUTHORITY"];
  if (filters.report === "pending") and.push({qmsRecord:{versions:{none:{}}},OR:[{scenario:null},{scenario:{notIn:received}}]});
  if (filters.situation === "closed") and.push({status:"CLOSED"});
  if (filters.situation === "partial") and.push({status:"OPEN",OR:[{scenario:{in:["INTERNAL_COVEX","INTERNAL_CONTRACTED"]},capaPlanEstablishedAt:{not:null}},{scenario:"SUPPLIER",reportSentAt:{not:null}}]});
  if (filters.situation === "followup") and.push({status:"OPEN",AND:[{OR:[{qmsRecord:reportVersion},{scenario:{in:received}}]}],NOT:{OR:[{scenario:{in:["INTERNAL_COVEX","INTERNAL_CONTRACTED"]},capaPlanEstablishedAt:{not:null}},{scenario:"SUPPLIER",reportSentAt:{not:null}}]},OR:[{findings:{some:{isActive:true,actions:{some:{isActive:true,status:{in:pendingActionStatuses}}}}}},{followups:{some:{}}}]});
  const years = validYears(filters.year); if (years.length) and.push({ qmsRecord: { year: { in: years } } });
  for (const [key, values, labels] of [["auditType", filters.type, auditTypeLabels], ["scenario", filters.scenario, auditScenarioLabels], ["status", filters.status, auditStatusLabels], ["modality", filters.modality, auditModalityLabels], ["dataQualityStatus", filters.quality, auditQualityLabels]] as const) {
    const selected = validValues(values, Object.keys(labels)); if (selected.length) and.push({ [key]: { in: selected } } as Prisma.AuditWhereInput);
  }
  if (filters.department?.length) and.push({ departments: { some: { isActive: true, departmentId: { in: filters.department } } } });
  const day = (v?: string) => v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v ? new Date(v) : undefined;
  for (const [key, from, to] of [["plannedDate", filters.plannedFrom, filters.plannedTo], ["performedDate", filters.performedFrom, filters.performedTo]] as const) {
    const gte = day(from), lte = day(to); if (gte || lte) and.push({ [key]: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } });
  }
  if (filters.findings === "yes") and.push({ findings: { some: { isActive: true } } });
  if (filters.findings === "no") and.push({ findings: { none: { isActive: true } } });
  const criticalities = validValues(filters.criticality, ["CRITICAL","MAJOR","MINOR","NA"] as const);
  if (criticalities.length) and.push({ findings: { some: { isActive: true, criticality: { in: criticalities as AuditFindingCriticality[] } } } });
  const pending = { isActive: true, actions: { some: { isActive: true, status: { in: pendingActionStatuses } } } };
  if (filters.pendingActions === "yes") and.push({ findings: { some: pending } });
  if (filters.pendingActions === "no") and.push({ findings: { none: pending } });
  for (const [type, value] of [["DEVIATION", filters.relatedDeviation], ["CAPA", filters.relatedCapa]] as const) {
    const relation = { isActive: true, relationType: "GENERATES" as const, targetRecord: { recordType: type } };
    if (value === "yes" || value === "no") and.push({ qmsRecord: { sourceRelations: { [value === "yes" ? "some" : "none"]: relation } } });
  }
  const q = filters.q?.trim().slice(0, 500);
  if (q) {
    const contains = { contains: q, mode: "insensitive" as const };
    and.push({ OR: [
      { qmsRecord: { businessCode: contains } }, { qmsRecord: { annulledBusinessCode: contains } },
      ...["title", "scope", "referenceText", "externalReference", "auditedEntityName", "auditingEntityName", "entityCode"].map(key => ({ [key]: contains })),
      { participants: { some: { isActive: true, OR: [{ displayName: contains }, { organization: contains }, { position: contains }] } } },
      { departments: { some: { isActive: true, OR: [{ departmentCodeSnapshot: contains }, { departmentNameSnapshot: contains }] } } },
      { findings: { some: { isActive: true, OR: [{ reference: contains }, { description: contains }, { actions: { some: { isActive: true, description: contains } } }] } } },
      { qmsRecord: { sourceRelations: { some: { isActive: true, targetRecord: { OR: [{ businessCode: contains }, { annulledBusinessCode: contains }] } } } } },
    ] });
  }
  return { AND: and };
}
export async function getAuditList(filters: AuditListFilters) {
  const where = auditListWhere({ ...filters, assignedUserId: currentIdentity()?.principal.id }), pageSize = 25;
  const { from, to, errors } = nextReviewRange(filters);
  // An invalid restrictive filter must never silently widen the result set.
  if (errors.length) (where.AND as Prisma.AuditWhereInput[]).push({ id: { in: [] } });
  return prisma.$transaction(async tx => {
    if (filters.signedPdf === "yes" || filters.signedPdf === "no") {
      const signed = await tx.$queryRaw<{qmsRecordId:string}[]>(Prisma.sql`SELECT v."qmsRecordId" FROM "RecordVersionDocument" d JOIN "QmsRecordVersion" v ON v.id=d."recordVersionId" WHERE d.kind='SIGNED_PDF' AND NOT EXISTS (SELECT 1 FROM "QmsRecordVersion" w WHERE w."qmsRecordId"=v."qmsRecordId" AND w."sequenceNumber">v."sequenceNumber")`);
      (where.AND as Prisma.AuditWhereInput[]).push({qmsRecordId: filters.signedPdf === "yes" ? {in:signed.map(v=>v.qmsRecordId)} : {notIn:signed.map(v=>v.qmsRecordId)}});
    }
    // Latest followup per active scope (general or active finding), including an explicit blank.
    // An unrelated later general note must not hide a pending finding review.
    if (!errors.length && (from || to)) {
      const ids = await tx.$queryRaw<{auditId:string}[]>(Prisma.sql`SELECT DISTINCT latest."auditId" FROM (
        SELECT DISTINCT ON (f."auditId", f."findingId") f."auditId", f."findingId", f."nextReviewDate"
        FROM "AuditFollowup" f
        ORDER BY f."auditId", f."findingId", f."followupDate" DESC, f."createdAt" DESC, f.id DESC
      ) latest
      LEFT JOIN "AuditFinding" finding ON finding.id=latest."findingId"
      WHERE (latest."findingId" IS NULL OR (finding."isActive"=true AND finding."auditId"=latest."auditId"))
        AND latest."nextReviewDate" IS NOT NULL
        ${from ? Prisma.sql`AND latest."nextReviewDate" >= ${from}` : Prisma.empty}
        ${to ? Prisma.sql`AND latest."nextReviewDate" <= ${to}` : Prisma.empty}`);
      (where.AND as Prisma.AuditWhereInput[]).push({ id: { in: ids.map(r => r.auditId) } });
    }
    const total = await tx.audit.count({ where });
    const page = Math.min(Math.max(1, Number(filters.page) || 1), Math.max(1, Math.ceil(total / pageSize)));
    const [rows, departments, years] = await Promise.all([
      tx.audit.findMany({ where, include: { findings: { where: { isActive: true }, select: { id: true, isActive: true, findingType: true, criticality: true, treatment: true, treatmentStatus: true, actions: { where: { isActive: true }, select: { isActive: true, status: true } } } }, followups: { orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }, { id: "desc" }], select: { findingId: true, nextReviewDate: true } }, qmsRecord: { include: { versions: { orderBy: {sequenceNumber:"desc"}, take:1, select:{sequenceNumber:true,documents:{where:{kind:"SIGNED_PDF"},select:{id:true}}} }, _count: { select: { sourceRelations: { where: { isActive: true } } } } } }, planEntry:{include:{plan:true}}, departments: { where: { isActive: true } }, participants: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (Math.floor(page) - 1) * pageSize, take: pageSize }),
      tx.department.findMany({ orderBy: { code: "asc" } }),
      tx.qmsRecord.findMany({ where: { recordType: "AUDIT", year: { not: null } }, distinct: ["year"], select: { year: true }, orderBy: { year: "desc" } }),
    ]);
    return { rows: await withActiveReviewCounts(rows, tx), departments, years: years.flatMap(r => r.year === null ? [] : [r.year]), total, page: Math.floor(page), pages: Math.max(1, Math.ceil(total / pageSize)), errors };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function getAuditDetail(id: string) {
  return prisma.audit.findUnique({ where: { id }, include: { qmsRecord: { include: { history: { orderBy: [{ changedAt: "desc" }, { id: "desc" }] } } }, departments: true, participants: true } });
}
export async function getAuditDepartments() { return prisma.department.findMany({ orderBy: { code: "asc" } }); }
