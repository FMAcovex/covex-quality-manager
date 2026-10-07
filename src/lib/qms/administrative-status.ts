import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
export class AdministrativeStatusError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
export async function changeAdministrativeStatus(id: string, action: "ANNUL" | "REACTIVATE", reason: string, actor: string) {
  if (reason.trim().length < 3 || !actor.trim()) throw new AdministrativeStatusError("Motivo y actor son obligatorios.", 400);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "QmsRecord" WHERE id = ${id} FOR UPDATE`);
    const record = await tx.qmsRecord.findUnique({ where: { id }, include: { audit: { select: { status: true, scenario: true } } } });
    if (!record) throw new AdministrativeStatusError("El expediente ya no existe.", 404);
    if (action === "ANNUL") {
      if (!record.isActive) throw new AdministrativeStatusError("El expediente ya está anulado.", 409);
      await tx.qmsRecord.update({ where: { id }, data: { businessCode: null, annulledBusinessCode: record.businessCode, isActive: false, annulledAt: new Date(), annulledByText: actor, annulledReason: reason } });
      await tx.changeHistory.create({ data: { qmsRecordId: id, changedByText: actor, fieldPath: "__administrative_status__", oldValue: { isActive: true, businessCode: record.businessCode }, newValue: { isActive: false, annulledBusinessCode: record.businessCode }, reason, source: "UI" } });
      return "ANNULLED";
    }
    if (record.isActive) throw new AdministrativeStatusError("El expediente ya está activo.", 409);
    const code = record.annulledBusinessCode;
    const codeOptionalAudit = record.audit && (record.audit.status === "DRAFT" || record.audit.scenario === "CLIENT" || record.audit.scenario === "AUTHORITY");
    if (!code && !codeOptionalAudit) throw new AdministrativeStatusError("El expediente anulado no conserva una codificación histórica válida.", 409);
    if (code && await tx.qmsRecord.findFirst({ where: { id: { not: id }, recordType: record.recordType, businessCode: code, isActive: true }, select: { id: true } })) throw new AdministrativeStatusError("No se puede reactivar: la codificación original ya ha sido reutilizada por otro expediente activo.", 409);
    await tx.qmsRecord.update({ where: { id }, data: { businessCode: code, annulledBusinessCode: null, isActive: true, annulledAt: null, annulledByText: null, annulledReason: null } });
    await tx.changeHistory.create({ data: { qmsRecordId: id, changedByText: actor, fieldPath: "__administrative_status__", oldValue: { isActive: false, annulledBusinessCode: code }, newValue: { isActive: true, businessCode: code }, reason, source: "UI" } });
    return "ACTIVE";
  });
}
