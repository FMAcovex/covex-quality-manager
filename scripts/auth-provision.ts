/** Offline, explicit administrative provisioning. Never called by startup/seed/HTTP. */
import { z } from "zod";
import { prisma } from "../src/lib/db";
import { authConfiguration } from "../src/lib/auth/config";
import { initialRoles } from "../src/lib/auth/roles";

async function main() {
  const config = authConfiguration();
  if (config.synthetic) throw new Error("Use the isolated fixture installer for synthetic accounts.");
  const command = process.argv[2];
  if (command === "bootstrap") {
    const input = z.object({ objectId: z.string().uuid(), displayName: z.string().min(1).max(200), email: z.string().email(), reason: z.string().min(10), confirmation: z.literal("IT_AUTHORIZED_INITIAL_ADMIN") }).parse(JSON.parse(process.argv[3] ?? "{}"));
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(4181001)`;
      if (await tx.authUser.count()) throw new Error("Initial provisioning requires an empty identity registry.");
      for (const role of initialRoles) await tx.authRole.create({ data: { ...role } });
      const role = await tx.authRole.update({ where: { key: "TECHNICAL_ADMIN" }, data: { qaAcceptedAt: new Date(), qaAcceptedBy: "IT_INITIAL_ACCESS_ONLY", permissions: { create: [{ module: "SYSTEM", permission: "READ", scope: "ALL" }, { module: "SYSTEM", permission: "MANAGE_USERS", scope: "ALL" }] } } });
      const user = await tx.authUser.create({ data: { tenantId: config.tenantId, objectId: input.objectId, displayName: input.displayName, email: input.email, active: true, authorizedAt: new Date(), roles: { create: { roleId: role.id } } } });
      await tx.authAuthorizationChange.create({ data: { actorUserId: user.id, targetUserId: user.id, source: "CONTROLLED_OFFLINE_PROVISIONING", action: "INITIAL_TECHNICAL_ADMIN", reason: input.reason } });
    });
    console.log("Initial technical access provisioned. No operational GMP permissions granted.");
  } else if (command === "accept-role-policy") {
    const input = z.object({ roleKey: z.string(), administratorId: z.string().uuid(), qaDtReference: z.string().min(10).max(500), reason: z.string().min(10), confirmation: z.literal("QA_DT_ACCEPTED_POLICY") }).parse(JSON.parse(process.argv[3] ?? "{}"));
    await prisma.$transaction(async tx => {
      const admin = await tx.authUser.findUniqueOrThrow({ where: { id: input.administratorId }, include: { roles: { include: { role: true } } } });
      if (!admin.active || !admin.authorizedAt || !admin.roles.some(r => r.role.key === "TECHNICAL_ADMIN")) throw new Error("Controlled administrator required.");
      const role = await tx.authRole.findUniqueOrThrow({ where: { key: input.roleKey }, include: { permissions: true, users: true } });
      if (role.key === "TECHNICAL_ADMIN" || role.users.some(u => u.userId === admin.id)) throw new Error("The administrator cannot accept their own policy.");
      await tx.authRole.update({ where: { id: role.id }, data: { qaAcceptedAt: new Date(), qaAcceptedBy: input.qaDtReference } });
      await tx.authSession.updateMany({ where: { userId: { in: role.users.map(u => u.userId) }, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.authAuthorizationChange.create({ data: { actorUserId: admin.id, source: "CONTROLLED_OFFLINE_PROVISIONING", action: "QA_DT_POLICY_ACCEPTANCE_RECORDED", newValue: { roleId: role.id, reference: input.qaDtReference, grants: role.permissions }, reason: input.reason } });
    });
    console.log("Administrative policy acceptance recorded. This is not a GMP electronic approval or signature.");
  } else throw new Error("Explicit bootstrap or accept-role-policy command required.");
}
main().catch(() => { console.error("Provisioning refused. Verify explicit authorization, configuration and inputs locally."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
