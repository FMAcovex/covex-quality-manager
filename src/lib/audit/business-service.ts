import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireUser } from "../auth/session";
import { isolatedTestEnvironment } from "../auth/config";
import type { AccessModule, AccessPermission, Principal } from "../auth/context";
import { AccessError } from "../auth/context";
import { AuditEngineError } from "./domain";
import { assertAuditApplicationRole, assertAuditProtection } from "./protection";
import { inDatabaseTransaction } from "../transaction-context";

const commandSchema = z.object({ requestId: z.string().uuid(), digest: z.string().regex(/^[a-f0-9]{64}$/), reason: z.string().trim().min(1).max(500).nullable() }).strict();
export type BusinessAuditCommand = z.infer<typeof commandSchema>;
export type BusinessAuditDescriptor = { operationCode: string; module: AccessModule; permission: AccessPermission };
export type BusinessAuditReceipt = { operationId: string | null; replayed: boolean };

/** SQL foundation adapter, server composition only. No HTTP route/activation API.
 * Module, permission and semantic operation come from the trusted writer adapter,
 * never from FormData. Corporate execution remains denied while B2 is incomplete.
 */
export async function withBusinessAudit(descriptor: BusinessAuditDescriptor, raw: BusinessAuditCommand,
  execute: (tx: Prisma.TransactionClient, principal: Principal) => Promise<void>, db: PrismaClient = prisma): Promise<BusinessAuditReceipt> {
  if (!isolatedTestEnvironment()) throw new AuditEngineError("CONTEXT");
  const command = commandSchema.parse(raw), authenticated = await requireUser();
  try {
    return await db.$transaction(async tx => {
      await assertAuditProtection(tx); await assertAuditApplicationRole(tx);
      const [started] = await tx.$queryRaw<{ operation_id: string | null; replayed: boolean }[]>(Prisma.sql`SELECT * FROM covex_b2_begin(${authenticated.id}::uuid,${command.requestId}::uuid,${command.digest},${descriptor.operationCode},${descriptor.module},${descriptor.permission},${command.reason})`);
      if (!started) throw new AuditEngineError("CONTEXT");
      if (started.replayed) return { operationId: started.operation_id, replayed: true };
      await inDatabaseTransaction(tx, () => execute(tx, authenticated));
      const [receipt] = await tx.$queryRaw<{ operationId: string | null }[]>(Prisma.sql`SELECT id AS "operationId" FROM "AuditOperation" WHERE "actorUserId"=${authenticated.id}::uuid AND origin='QMS_SERVER' AND "requestId"=${command.requestId}::uuid`);
      return { operationId: receipt?.operationId ?? null, replayed: false };
    }, { timeout: 30000, maxWait: 10000 });
  } catch (error) {
    if (error instanceof AccessError || error instanceof AuditEngineError) throw error;
    throw new AuditEngineError("WRITE_FAILED");
  }
}
