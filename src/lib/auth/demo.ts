import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "../db";
import { AccessError } from "./context";
import { authConfiguration, demoTenant } from "./config";
import { cookieOptions } from "./oidc";
import { cookieNames, issueSession } from "./session";
import { demoProfiles } from "./demo-profiles";


function demoEnabled() {
  try { return authConfiguration().demo; } catch { return false; }
}

/** Perfiles de la demo para la página de acceso; vacío fuera de la demo local. */
export async function listDemoUsers() {
  if (!demoEnabled()) return [];
  const users = await prisma.authUser.findMany({ where: { tenantId: demoTenant, active: true, authorizedAt: { not: null } }, select: { id: true } });
  const available = new Set(users.map(user => user.id));
  return demoProfiles.filter(profile => available.has(profile.id));
}

/** Abre una sesión normal de la aplicación para un perfil de la demo local. */
export async function startDemoSession(request: Request) {
  const config = authConfiguration();
  if (!config.demo) throw new AccessError(403);
  if (request.headers.get("origin") !== config.origin) throw new AccessError(403);
  const userId = String((await request.formData()).get("userId") ?? "");
  if (!demoProfiles.some(profile => profile.id === userId)) throw new AccessError(403);
  const user = await prisma.authUser.findFirst({ where: { id: userId, tenantId: demoTenant }, select: { id: true } });
  if (!user) throw new AccessError(403);
  const session = await issueSession(user.id), names = cookieNames(), response = NextResponse.redirect(new URL("/", config.origin), 303);
  response.cookies.set(names.session, session.token, { ...cookieOptions(), maxAge: config.ttlMs / 1000 });
  response.cookies.set(names.csrf, session.csrf, { ...cookieOptions(), httpOnly: false, maxAge: config.ttlMs / 1000 });
  return response;
}
