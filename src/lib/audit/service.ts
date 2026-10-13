import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../db";
import { requireUser } from "../auth/session";
import { isolatedTestEnvironment } from "../auth/config";
import { AccessError, type Principal } from "../auth/context";
import { assertPermission } from "../auth/policy";
import { AuditEngineError, commandDigest, pilotCommandSchema, type PilotCommand } from "./domain";
import { assertAuditApplicationRole, assertAuditProtection } from "./protection";

export type AuditReceipt = { operationId: string; replayed: boolean };

/** Trusted server composition only; never accept a callback/principal from HTTP. */
export async function withAuditedOperation(raw: unknown, execute: (tx: Prisma.TransactionClient, principal: Principal, command: PilotCommand) => Promise<void>, db: PrismaClient = prisma): Promise<AuditReceipt> {
  if (!isolatedTestEnvironment()) throw new AuditEngineError("CONTEXT");
  const command = pilotCommandSchema.parse(raw), authenticated = await requireUser();
  try {
    return await db.$transaction(async tx => {
      await assertAuditProtection(tx); await assertAuditApplicationRole(tx);
      // Reauthorize every target before an idempotent receipt or a write is returned.
      const roots = [...command.changes].sort((a,b)=>a.qmsRecordId.localeCompare(b.qmsRecordId));
      for (const root of roots) {
        const record = await tx.qmsRecord.findUnique({ where: { id: root.qmsRecordId }, include: { deviation: { select: { departmentId: true } } } });
        if (!record || !record.isActive || record.recordType!=="DEVIATION") throw new AccessError(403);
        assertPermission(authenticated,"DEVIATION","EDIT",{id:record.id,departmentIds:record.deviation?.departmentId?[record.deviation.departmentId]:[]});
      }
      const [started] = await tx.$queryRaw<{ operation_id: string; replayed: boolean }[]>(Prisma.sql`SELECT * FROM public.covex_audit_begin(${authenticated.id}::uuid,${command.requestId}::uuid,${commandDigest(command)},${command.reason},${JSON.stringify(roots.map(r=>({kind:"QMS_RECORD",id:r.qmsRecordId})))}::jsonb)`);
      if (!started) throw new AuditEngineError("CONTEXT");
      if (!started.replayed) await execute(tx, authenticated, command);
      return { operationId: started.operation_id, replayed: started.replayed };
    }, { timeout: 30000, maxWait: 10000 });
  } catch(error) {
    if (error instanceof AccessError || error instanceof AuditEngineError) throw error;
    // SQL/record values never escape through framework logs or messages.
    throw new AuditEngineError("WRITE_FAILED");
  }
}

/** No route/UI: an isolated numeric fixture, not a GMP business operation. */
export function updateAuditPilot(raw: unknown, db: PrismaClient = prisma) {
  return withAuditedOperation(raw, async (tx, principal, command) => {
    for (const change of [...command.changes].sort((a,b)=>a.qmsRecordId.localeCompare(b.qmsRecordId))) {
      const before = await tx.auditPilotRecord.findUniqueOrThrow({ where: { qmsRecordId: change.qmsRecordId } });
      if (change.expectedRevision!==undefined && change.expectedRevision!==before.revision) throw new AuditEngineError("CONFLICT");
      const after = await tx.auditPilotRecord.update({ where: { qmsRecordId: change.qmsRecordId }, data: { value: change.value } });
      await tx.changeHistory.create({ data: { qmsRecordId: change.qmsRecordId, fieldPath: "__synthetic_audit_pilot__", oldValue: {value:before.value,revision:before.revision}, newValue: {value:after.value,revision:after.revision}, authenticatedUserId: principal.id, changedByText: principal.name, reason: command.reason, source: "SYSTEM" } });
    }
  }, db);
}
