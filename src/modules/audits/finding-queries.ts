import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { responsibleUserSelect } from "@/lib/qms/responsible-user";
export const auditFindingInclude = {
  actions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { responsibleUser: responsibleUserSelect } },
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

/**
 * Datos de un hallazgo para rellenar el alta de una CAPA o Desviación desde él (R5B2).
 * Devuelve null si el hallazgo está retirado o la auditoría anulada.
 */
export async function getAuditFindingOrigin(findingId: string) {
  const finding = await prisma.auditFinding.findUnique({
    where: { id: findingId },
    select: {
      id: true, reference: true, description: true, isActive: true,
      audit: { select: { id: true, title: true, codingDepartmentId: true, departments: { where: { isActive: true }, select: { departmentId: true }, take: 1 }, qmsRecord: { select: { id: true, businessCode: true, year: true, isActive: true } } } },
    },
  });
  if (!finding?.isActive || !finding.audit.qmsRecord.isActive) return null;
  const audit = finding.audit;
  return {
    findingId: finding.id, reference: finding.reference, description: finding.description,
    auditId: audit.id, auditTitle: audit.title, auditRecord: audit.qmsRecord,
    auditLabel: audit.qmsRecord.businessCode ?? audit.title ?? "Auditoría sin código",
    departmentId: audit.codingDepartmentId ?? audit.departments[0]?.departmentId ?? null,
  };
}
