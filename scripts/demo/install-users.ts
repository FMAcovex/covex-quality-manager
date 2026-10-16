/**
 * Usuarios y roles ficticios de la demo local (D-087). Solo se ejecuta en la
 * demo local (`localDemoEnvironment`) y con ALLOW_DEMO_DATA=true.
 */
import { prisma } from "../../src/lib/db";
import { demoTenant, localDemoEnvironment } from "../../src/lib/auth/config";
import type { AccessModule, AccessPermission, Grant } from "../../src/lib/auth/context";
import { initialRoles } from "../../src/lib/auth/roles";
import { assignablePermissions, roleEditorModules } from "../../src/lib/auth/role-policy";
import { demoProfiles } from "../../src/lib/auth/demo-profiles";

const recordModules = roleEditorModules.map(m => m.key).filter((key): key is Exclude<AccessModule, "SYSTEM"> => key !== "SYSTEM");
const grantsFor = (modules: readonly AccessModule[], wanted: readonly AccessPermission[] | "ALL", scope: Grant["scope"]) =>
  modules.flatMap(module => assignablePermissions(module).filter(p => wanted === "ALL" || wanted.includes(p)).map(permission => ({ module, permission, scope })));

const roleGrants: Record<string, Grant[]> = {
  QUALITY_ASSURANCE: grantsFor(roleEditorModules.map(m => m.key), "ALL", "ALL"),
  DEPARTMENT_MANAGER: grantsFor(recordModules, ["CREATE", "EDIT", "FOLLOWUP", "REVIEW", "DOWNLOAD", "ATTACH_DOCUMENT", "GENERATE_DOCUMENT"], "ASSIGNED"),
  READER: grantsFor(recordModules, ["DOWNLOAD"], "ALL"),
  TECHNICAL_ADMIN: [{ module: "SYSTEM", permission: "READ", scope: "ALL" }, { module: "SYSTEM", permission: "MANAGE_USERS", scope: "ALL" }],
};

export async function installDemoUsers() {
  if (!localDemoEnvironment() || process.env.ALLOW_DEMO_DATA !== "true") throw new Error("Solo para la demo local (APP_ENV=demo, base covex_demo, ALLOW_DEMO_DATA=true).");
  const department = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });
  await prisma.$transaction(async tx => {
    for (const role of initialRoles) {
      const saved = await tx.authRole.upsert({ where: { key: role.key }, create: { ...role, qaAcceptedAt: new Date(), qaAcceptedBy: "DEMO_LOCAL_FICTICIA" }, update: { qaAcceptedAt: new Date(), qaAcceptedBy: "DEMO_LOCAL_FICTICIA" } });
      if (!(role.key in roleGrants)) continue;
      await tx.authRolePermission.deleteMany({ where: { roleId: saved.id } });
      await tx.authRolePermission.createMany({ data: roleGrants[role.key].map(grant => ({ ...grant, roleId: saved.id })) });
    }
    for (const profile of demoProfiles) {
      await tx.authUser.upsert({
        where: { id: profile.id },
        create: { id: profile.id, tenantId: demoTenant, objectId: profile.objectId, displayName: profile.name, email: `${profile.role.toLowerCase()}@demo.invalid`, active: true, authorizedAt: new Date() },
        update: { active: true, authorizedAt: new Date() },
      });
      const role = await tx.authRole.findUniqueOrThrow({ where: { key: profile.role } });
      await tx.authUserRole.upsert({ where: { userId_roleId: { userId: profile.id, roleId: role.id } }, create: { userId: profile.id, roleId: role.id }, update: {} });
    }
    const manager = demoProfiles.find(profile => profile.role === "DEPARTMENT_MANAGER")!;
    await tx.authUserDepartment.upsert({ where: { userId_departmentId: { userId: manager.id, departmentId: department.id } }, create: { userId: manager.id, departmentId: department.id }, update: {} });
  });
}

if (process.argv[1]?.endsWith("/demo/install-users.ts")) installDemoUsers()
  .then(() => console.log("Usuarios ficticios de la demo local preparados."))
  .catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
