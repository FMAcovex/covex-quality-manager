import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "../db";
import { authConfiguration, isolatedTestEnvironment } from "./config";
import { AccessError, currentIdentity, type Principal } from "./context";

export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export function cookieNames() {
  const prefix = authConfiguration().secure ? "__Host-" : "";
  return { session: prefix + "covex-session", csrf: prefix + "covex-csrf", flow: prefix + "covex-auth-flow" };
}
export function requestCookie(request: Request, name: string) {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) { try { return decodeURIComponent(value.join("=")); } catch { return ""; } }
  }
  return "";
}
export async function principalById(id: string): Promise<Principal> {
  const user = await prisma.authUser.findUnique({ where: { id }, include: { roles: { include: { role: { include: { permissions: true } } } }, departments: true, assignments: true } });
  if (!user?.active || !user.authorizedAt) throw new AccessError(403, "Usuario sin autorización activa.");
  if (user.tenantId !== authConfiguration().tenantId) throw new AccessError(403, "Usuario fuera del tenant autorizado.");
  return { id: user.id, tenantId: user.tenantId, objectId: user.objectId, name: user.displayName, email: user.email, active: user.active, authorized: Boolean(user.authorizedAt),
    roles: user.roles.map(r => r.role.key), grants: user.roles.flatMap(r => r.role.qaAcceptedAt ? r.role.permissions : []).map(g => ({ module: g.module, permission: g.permission, scope: g.scope })),
    departmentIds: user.departments.map(d => d.departmentId), assignments: user.assignments.map(a => ({ module: a.module, recordId: a.recordId })) };
}
export async function sessionFromToken(token: string) {
  const config = authConfiguration();
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AccessError(401, "Debe iniciar sesión.");
  const session = await prisma.authSession.findUnique({ where: { tokenHash: hash(token) } });
  const now = new Date();
  if (!session || session.revokedAt || session.expiresAt <= now || now.getTime() - session.lastSeenAt.getTime() >= config.idleMs) throw new AccessError(401, "La sesión no está vigente.");
  const principal = await principalById(session.userId);
  if (now.getTime() - session.lastSeenAt.getTime() > 60000) await prisma.authSession.updateMany({ where: { id: session.id, revokedAt: null, expiresAt: { gt: now } }, data: { lastSeenAt: now } });
  return { session, principal };
}
export async function requireUser(request?: Request): Promise<Principal> {
  const context = currentIdentity();
  if (context?.unitTest && process.env.VITEST === "true" && process.env.APP_ENV === "test") return context.principal;
  authConfiguration();
  if (context?.testHarness && isolatedTestEnvironment()) return principalById(context.principal.id);
  if (context && !context.unitTest && !context.testHarness) return principalById(context.principal.id);
  const token = request ? requestCookie(request, cookieNames().session) : (await cookies()).get(cookieNames().session)?.value ?? "";
  return (await sessionFromToken(token)).principal;
}
export async function requireCsrf(request?: Request, form?: FormData) {
  const context = currentIdentity();
  if (context?.unitTest && process.env.VITEST === "true" && process.env.APP_ENV === "test") return;
  if (context?.testHarness && isolatedTestEnvironment()) return;
  const config = authConfiguration(), names = cookieNames();
  const hdr = request?.headers ?? await headers();
  if (!config.requestOrigins.includes(hdr.get("origin") ?? "")) throw new AccessError(403, "Origen de solicitud no autorizado.");
  const token = request ? requestCookie(request, names.session) : (await cookies()).get(names.session)?.value ?? "";
  const { session } = await sessionFromToken(token);
  const supplied = hdr.get("x-covex-csrf") ?? String(form?.get("_covexCsrf") ?? "");
  const actual = Buffer.from(hash(supplied), "hex"), expected = Buffer.from(session.csrfHash, "hex");
  if (!supplied || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new AccessError(403, "Solicitud no autorizada.");
}
export async function issueSession(userId: string) {
  const config = authConfiguration(); await principalById(userId);
  const token = randomToken(), csrf = randomToken();
  await prisma.authSession.create({ data: { userId, tokenHash: hash(token), csrfHash: hash(csrf), expiresAt: new Date(Date.now() + config.ttlMs) } });
  return { token, csrf };
}
export async function revokeUserSessions(userId: string) {
  await prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
