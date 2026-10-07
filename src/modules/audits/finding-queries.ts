import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
export const auditFindingInclude = {
  actions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
  relations: { where: { isActive: true }, include: { qmsRelation: { include: { targetRecord: { include: { capa: { select: { status: true, effectivenessStatus: true } }, deviation: { select: { status: true } } } } } } } },
} satisfies Prisma.AuditFindingInclude;
export async function getAuditWork(auditId: string) {
  return prisma.audit.findUnique({ where: { id: auditId }, include: {
    findings: { include: auditFindingInclude, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    followups: { include: { finding: { select: { id: true, reference: true, isActive: true } } }, orderBy: [{ followupDate: "desc" }, { createdAt: "desc" }, { id: "desc" }] },
    qmsRecord: { include: { sourceRelations: { where: { isActive: true }, include: { targetRecord: { include: { capa: { select: { status: true, effectivenessStatus: true } }, deviation: { select: { status: true } } } }, auditFindingRelations: { where: { isActive: true }, include: { finding: { select: { id: true, reference: true, isActive: true } } } } } } } },
  } });
}
export async function getAuditOrigins(targetRecordId: string) {
  return prisma.qmsRelation.findMany({ where: { targetRecordId, isActive: true, relationType: "GENERATES", sourceRecord: { recordType: "AUDIT" } }, include: { sourceRecord: { include: { audit: { select: { id: true, title: true, externalReference: true } } } }, auditFindingRelations: { where: { isActive: true }, include: { finding: { select: { id: true, reference: true, isActive: true } } } } }, orderBy: { createdAt: "asc" } });
}
