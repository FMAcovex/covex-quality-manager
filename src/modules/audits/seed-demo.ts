import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
export async function seedAuditDemo(prisma: PrismaClient) {
  const department = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });
  // Same DEMO- convention as the existing five modules, explicitly non-operational.
  const qms = await prisma.qmsRecord.upsert({ where: { recordType_businessCode: { recordType: "AUDIT", businessCode: "DEMO-AUD-001-2026" } }, update: {}, create: { recordType: "AUDIT", businessCode: "DEMO-AUD-001-2026", year: 2026 } });
  const audit = await prisma.audit.upsert({ where: { qmsRecordId: qms.id }, update: {}, create: {
    qmsRecordId: qms.id, auditType: "INTERNAL", scenario: "INTERNAL_COVEX", status: "DRAFT", title: "Auditoría ficticia del sistema documental", scope: "Revisión simulada de documentación del sistema de calidad", referenceText: "GC-00/033/03 · ejemplo ficticio", plannedDate: new Date("2026-11-10"), modality: "ONSITE", codingDepartmentId: department.id, codingDepartmentCodeSnapshot: department.code, codingDepartmentNameSnapshot: department.name, internalObservations: "DATOS FICTICIOS DEMO. Borrador con código DEMO no normativo; al abrir se asigna AI/GC-00/YY/2026.", createdByText: "Usuario demo",
  } });
  await prisma.auditDepartment.upsert({ where: { auditId_departmentId: { auditId: audit.id, departmentId: department.id } }, update: {}, create: { auditId: audit.id, departmentId: department.id, departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name } });
  if (!(await prisma.auditParticipant.count({ where: { auditId: audit.id } }))) await prisma.auditParticipant.createMany({ data: [
    { auditId: audit.id, displayName: "Auditor jefe demo", role: "LEAD_AUDITOR", organization: "COVEX (demo)", sortOrder: 0 },
    { auditId: audit.id, displayName: "Auditor demo", role: "AUDITOR", organization: "COVEX (demo)", sortOrder: 10 },
    { auditId: audit.id, displayName: "Interlocutor demo", role: "AUDITEE", sortOrder: 20 },
  ] });
  if (!(await prisma.changeHistory.count({ where: { qmsRecordId: qms.id } }))) await prisma.changeHistory.create({ data: { qmsRecordId: qms.id, fieldPath: "__created__", changedByText: "Usuario demo", reason: "Alta demo ficticia de Auditoría R3A", source: "SYSTEM" } });
  const obs = await prisma.auditFinding.upsert({ where: { auditId_reference: { auditId: audit.id, reference: "OBS 01" } }, update: {}, create: { auditId: audit.id, reference: "OBS 01", findingType: "FINDING", criticality: "MINOR", description: "OBS FICTICIA: revisión de una instrucción simulada", treatment: "Actualización documental simulada", createdByText: "Usuario demo" } });
  await prisma.auditFinding.upsert({ where: { auditId_reference: { auditId: audit.id, reference: "Rk 01" } }, update: {}, create: { auditId: audit.id, reference: "Rk 01", findingType: "RECOMMENDATION", criticality: "NA", description: "RECOMENDACIÓN FICTICIA: mejorar el índice documental", sortOrder: 10, createdByText: "Usuario demo" } });
  const childUuid = (key: string) => { const hex = createHash("sha256").update(`${audit.id}:${key}`).digest("hex"); return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`; };
  const previousAction = await prisma.auditFindingAction.findFirst({where:{findingId:obs.id,description:"Acción FICTICIA: revisar índice"},select:{id:true}});
  const previousFollowup = await prisma.auditFollowup.findFirst({where:{auditId:audit.id,description:"Seguimiento FICTICIO del ejemplo"},select:{id:true}});
  const actionId = previousAction?.id ?? childUuid("demo-action-1"), followupId = previousFollowup?.id ?? childUuid("demo-followup-1");
  await prisma.auditFindingAction.upsert({ where: { id: actionId }, update: {}, create: { id: actionId, findingId: obs.id, description: "Acción FICTICIA: revisar índice", responsible: "Responsable demo", targetDate: new Date("2026-11-20"), createdByText: "Usuario demo" } });
  await prisma.auditFollowup.upsert({ where: { id: followupId }, update: {}, create: { id: followupId, auditId: audit.id, findingId: obs.id, followupDate: new Date("2026-11-12"), completedByText: "Usuario demo", description: "Seguimiento FICTICIO del ejemplo", nextReviewDate: new Date("2026-11-20"), createdByText: "Usuario demo" } });
  return audit;
}
