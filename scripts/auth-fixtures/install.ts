import { prisma } from "../../src/lib/db";
import { authConfiguration, isolatedTestEnvironment } from "../../src/lib/auth/config";
import { accessModules, permissions, type Grant } from "../../src/lib/auth/context";
import { initialRoles } from "../../src/lib/auth/roles";
import { fixtureUsers, syntheticTenant } from "./constants";
export async function installAuthFixtures() {
  if (!isolatedTestEnvironment() || !authConfiguration().synthetic) throw new Error("Isolated synthetic database and provider required.");
  const byRole: Record<string, Grant[]> = {
    QUALITY_ASSURANCE: accessModules.flatMap(module => permissions.map(permission => ({ module, permission, scope: "ALL" as const }))),
    TECHNICAL_ADMIN: [{ module: "SYSTEM", permission: "READ", scope: "ALL" }, { module: "SYSTEM", permission: "MANAGE_USERS", scope: "ALL" }],
    READER: accessModules.filter(m => m !== "SYSTEM").map(module => ({ module, permission: "DOWNLOAD", scope: "ALL" })),
    DEPARTMENT_MANAGER: accessModules.filter(m => m !== "SYSTEM").flatMap(module => ["CREATE", "EDIT", "FOLLOWUP", "REVIEW", "DOWNLOAD"].map(permission => ({ module, permission: permission as Grant["permission"], scope: "ASSIGNED" as const }))),
    OPERATOR: [{ module: "PNT", permission: "DOWNLOAD", scope: "ALL" }, { module: "PNT", permission: "ATTACH_DOCUMENT", scope: "ALL" }],
  };
  await prisma.$transaction(async tx => {
    for (const role of initialRoles) {
      const r = await tx.authRole.upsert({ where: { key: role.key }, create: { ...role, qaAcceptedAt: new Date(), qaAcceptedBy: "ISOLATED_TEST_FIXTURE" }, update: { qaAcceptedAt: new Date(), qaAcceptedBy: "ISOLATED_TEST_FIXTURE" } });
      await tx.authRolePermission.deleteMany({ where: { roleId: r.id } });
      await tx.authRolePermission.createMany({ data: (byRole[role.key] ?? []).map(g => ({ ...g, roleId: r.id })) });
    }
    for (const fixture of Object.values(fixtureUsers)) {
      await tx.authUser.upsert({ where: { id: fixture.id }, create: { id: fixture.id, tenantId: syntheticTenant, objectId: fixture.oid, displayName: fixture.name, email: `${fixture.role.toLowerCase()}-${fixture.id.slice(-1)}@example.invalid`, active: fixture.active, authorizedAt: fixture.admitted ? new Date() : null }, update: { active: fixture.active, authorizedAt: fixture.admitted ? new Date() : null } });
      const role = await tx.authRole.findUniqueOrThrow({ where: { key: fixture.role } });
      await tx.authUserRole.upsert({ where: { userId_roleId: { userId: fixture.id, roleId: role.id } }, create: { userId: fixture.id, roleId: role.id }, update: {} });
    }
  });
}
if (process.argv[1]?.endsWith("/auth-fixtures/install.ts")) installAuthFixtures().then(() => console.log("Synthetic users with explicit test grants installed in isolated PostgreSQL.")).finally(() => prisma.$disconnect());
