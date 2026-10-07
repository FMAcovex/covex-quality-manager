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
  return audit;
}
