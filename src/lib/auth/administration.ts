import { z } from "zod";
import { prisma } from "../db";
import { auditPolicyState } from "../audit/activation";
import { accessModules, permissions, AccessError, identityContext, currentIdentity, type Principal } from "./context";
import { assertPermission } from "./policy";
import { requireCsrf, requireUser } from "./session";
import { authConfiguration } from "./config";
import { qmsScope } from "./resources";

const reason = z.string().trim().min(10).max(2000);

async function administrationCommand<T>(name: "administerUser" | "configureRole", input: unknown, actor: Principal, form: FormData | undefined, execute: () => Promise<T>) {
  const context = currentIdentity();
  return identityContext.run({ ...context, principal: actor, auditClaims: [...(context?.auditClaims ?? []), { module: "SYSTEM", permission: "MANAGE_USERS", resource: {} }] }, async () => {
    if (context?.unitTest && process.env.VITEST === "true" && process.env.APP_ENV === "test") return execute();
    if (!(await auditPolicyState(prisma)).required) return execute();
    const { actionAuditBoundary } = await import("../audit/action-boundary");
    return actionAuditBoundary(name, [input, ...(form ? [form] : [])], "SYSTEM", "MANAGE_USERS", execute);
  });
}
export const userChangeSchema = z.object({
  id: z.string().uuid().optional(), objectId: z.string().uuid(), displayName: z.string().trim().min(1).max(200), email: z.string().email().max(254),
  active: z.boolean(), roleIds: z.array(z.string().uuid()).max(6), departmentIds: z.array(z.string().min(1)).max(100),
  assignments: z.array(z.object({ module: z.enum(accessModules), recordId: z.string().uuid() }).strict()).max(500), reason,
}).strict();
export const roleChangeSchema = z.object({ roleId: z.string().uuid(), grants: z.array(z.object({ module: z.enum(accessModules), permission: z.enum(permissions), scope: z.enum(["ALL", "ASSIGNED"]) }).strict()).max(192), reason }).strict();

export async function administerUser(raw: unknown, form?: FormData) {
  const actor = await requireUser(); await requireCsrf(undefined, form); assertPermission(actor, "SYSTEM", "MANAGE_USERS");
  const input = userChangeSchema.parse(raw), config = authConfiguration();
  if (input.id === actor.id || (!input.id && input.objectId === actor.objectId)) throw new AccessError(403, "No puede modificar sus propias autorizaciones.");
  for (const assignment of input.assignments) {
    if (assignment.module === "SYSTEM") throw new AccessError(403);
    if (assignment.module === "PNT") await prisma.controlledDocument.findUniqueOrThrow({ where: { id: assignment.recordId }, select: { id: true } });
    else {
      const plan = assignment.module === "AUDIT" ? await prisma.auditAnnualPlan.findUnique({ where: { id: assignment.recordId }, select: { id: true } }) : null;
      if (!plan && (await qmsScope(assignment.recordId)).module !== assignment.module) throw new AccessError(403);
    }
  }
  const roles = await prisma.authRole.findMany({ where: { id: { in: input.roleIds } }, select: { id: true } });
  const departments = await prisma.department.findMany({ where: { id: { in: input.departmentIds }, isActive: true }, select: { id: true } });
  if (new Set(input.roleIds).size !== roles.length || new Set(input.departmentIds).size !== departments.length) throw new AccessError(403);
  return administrationCommand("administerUser", input, actor, form, () => prisma.$transaction(async tx => {
    const before = input.id ? await tx.authUser.findUniqueOrThrow({ where: { id: input.id }, include: { roles: true, departments: true, assignments: true } }) : null;
    if (before && (before.tenantId !== config.tenantId || before.objectId !== input.objectId)) throw new AccessError(403, "La identidad estable no se puede cambiar.");
    const user = before
      ? await tx.authUser.update({ where: { id: before.id }, data: { displayName: input.displayName, email: input.email, active: input.active, authorizedAt: input.active ? before.authorizedAt ?? new Date() : null } })
      : await tx.authUser.create({ data: { tenantId: config.tenantId, objectId: input.objectId, displayName: input.displayName, email: input.email, active: input.active, authorizedAt: input.active ? new Date() : null } });
    await tx.authUserRole.deleteMany({ where: { userId: user.id } });
    await tx.authUserDepartment.deleteMany({ where: { userId: user.id } });
    await tx.authRecordAssignment.deleteMany({ where: { userId: user.id } });
    await tx.authUserRole.createMany({ data: roles.map(r => ({ userId: user.id, roleId: r.id })) });
    await tx.authUserDepartment.createMany({ data: departments.map(d => ({ userId: user.id, departmentId: d.id })) });
    // Deduplicate before INSERT rather than SQL ON CONFLICT: speculative
    // BEFORE INSERT witnesses must not outlive a row skipped by PostgreSQL.
    const assignments = [...new Map(input.assignments.map(a => [JSON.stringify([a.module, a.recordId]), a])).values()];
    await tx.authRecordAssignment.createMany({ data: assignments.map(a => ({ ...a, userId: user.id })) });
    await tx.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.authAuthorizationChange.create({ data: { actorUserId: actor.id, source: "CORPORATE_SESSION", targetUserId: user.id, action: before ? "USER_AUTHORIZATION_CHANGED" : "USER_ADMITTED", oldValue: before ? JSON.parse(JSON.stringify(before)) : undefined, newValue: JSON.parse(JSON.stringify(input)), reason: input.reason } });
    return user.id;
  }));
}
export async function configureRole(raw: unknown, form?: FormData) {
  const actor = await requireUser(); await requireCsrf(undefined, form); assertPermission(actor, "SYSTEM", "MANAGE_USERS");
  const input = roleChangeSchema.parse(raw);
  return administrationCommand("configureRole", input, actor, form, () => prisma.$transaction(async tx => {
    const before = await tx.authRole.findUniqueOrThrow({ where: { id: input.roleId }, include: { permissions: true, users: true } });
    if (before.key === "TECHNICAL_ADMIN" || before.users.some(u => u.userId === actor.id)) throw new AccessError(403, "No puede cambiar su propio rol ni el rol técnico reservado.");
    const systemAssignable = ["READ", "MANAGE_CONFIGURATION", "AUDIT_TRAIL_REVIEW", "AUDIT_TRAIL_EXPORT", "AUDIT_TRAIL_SENSITIVE_READ"];
    const allScopeOnly = ["EXPORT", "IMPORT", "MANAGE_CONFIGURATION", "AUDIT_TRAIL_REVIEW", "AUDIT_TRAIL_EXPORT", "AUDIT_TRAIL_SENSITIVE_READ"];
    if (input.grants.some(g => g.permission === "MANAGE_USERS" || (g.module === "SYSTEM" && !systemAssignable.includes(g.permission)) || (g.scope === "ASSIGNED" && allScopeOnly.includes(g.permission)))) throw new AccessError(403);
    if (new Set(input.grants.map(g => `${g.module}:${g.permission}`)).size !== input.grants.length) throw new AccessError(403);
    await tx.authRolePermission.deleteMany({ where: { roleId: before.id } });
    await tx.authRolePermission.createMany({ data: input.grants.map(g => ({ ...g, roleId: before.id })) });
    await tx.authRole.update({ where: { id: before.id }, data: { qaAcceptedAt: null, qaAcceptedBy: null } });
    await tx.authSession.updateMany({ where: { userId: { in: before.users.map(u => u.userId) }, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.authAuthorizationChange.create({ data: { actorUserId: actor.id, source: "CORPORATE_SESSION", action: "ROLE_POLICY_PROPOSED", oldValue: JSON.parse(JSON.stringify(before)), newValue: input.grants, reason: input.reason } });
  }));
}
export async function requireUserAdministration() {
  const user = await requireUser(); assertPermission(user, "SYSTEM", "MANAGE_USERS"); return user;
}
