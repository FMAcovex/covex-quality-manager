import * as oidc from "openid-client";
import { NextResponse } from "next/server";
import { prisma } from "../db";
import { authConfiguration, safeReturnTo } from "./config";
import { cookieNames, hash, issueSession, principalById, randomToken, requestCookie } from "./session";
import { AccessError } from "./context";

export async function providerConfiguration() {
  const config = authConfiguration();
  const provider = await oidc.discovery(config.issuer, config.clientId, config.secret, undefined, config.synthetic ? { execute: [oidc.allowInsecureRequests] } : undefined);
  oidc.enableNonRepudiationChecks(provider);
  return provider;
}
const cookieOptions = () => ({ httpOnly: true, secure: authConfiguration().secure, sameSite: "lax" as const, path: "/" });
export async function startLogin(request: Request) {
  const config = authConfiguration(), provider = await providerConfiguration();
  const flow = randomToken(), state = oidc.randomState(), nonce = oidc.randomNonce(), verifier = oidc.randomPKCECodeVerifier();
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
  await prisma.authLoginAttempt.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await prisma.authLoginAttempt.create({ data: { id: hash(flow), state, nonce, verifier, returnTo, expiresAt: new Date(Date.now() + 5 * 60000) } });
  const location = oidc.buildAuthorizationUrl(provider, { redirect_uri: config.origin + "/auth/callback", scope: "openid profile email", response_type: "code", code_challenge_method: "S256", code_challenge: await oidc.calculatePKCECodeChallenge(verifier), state, nonce });
  const response = NextResponse.redirect(location); response.cookies.set(cookieNames().flow, flow, { ...cookieOptions(), maxAge: 300 }); return response;
}
export async function finishLogin(request: Request) {
  const config = authConfiguration(), names = cookieNames(), flow = requestCookie(request, names.flow);
  if (!/^[A-Za-z0-9_-]{43}$/.test(flow)) throw new AccessError(401);
  const attempt = await prisma.authLoginAttempt.findUnique({ where: { id: hash(flow) } });
  if (!attempt || attempt.expiresAt <= new Date()) throw new AccessError(401);
  const consumed = await prisma.authLoginAttempt.deleteMany({ where: { id: attempt.id, expiresAt: { gt: new Date() } } });
  if (consumed.count !== 1) throw new AccessError(401);
  const provider = await providerConfiguration();
  const callback = new URL(config.origin + "/auth/callback"); callback.search = new URL(request.url).search;
  const tokens = await oidc.authorizationCodeGrant(provider, callback, { pkceCodeVerifier: attempt.verifier, expectedState: attempt.state, expectedNonce: attempt.nonce, idTokenExpected: true });
  const claims = tokens.claims();
  if (!claims || typeof claims.tid !== "string" || claims.tid.toLowerCase() !== config.tenantId || typeof claims.oid !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.oid)) throw new AccessError(403);
  const user = await prisma.authUser.findUnique({ where: { tenantId_objectId: { tenantId: config.tenantId, objectId: claims.oid } }, select: { id: true } });
  if (!user) throw new AccessError(403); await principalById(user.id);
  const session = await issueSession(user.id), response = NextResponse.redirect(new URL(attempt.returnTo, config.origin));
  response.cookies.set(names.session, session.token, { ...cookieOptions(), maxAge: config.ttlMs / 1000 });
  response.cookies.set(names.csrf, session.csrf, { ...cookieOptions(), httpOnly: false, maxAge: config.ttlMs / 1000 });
  response.cookies.set(names.flow, "", { ...cookieOptions(), maxAge: 0 }); return response;
}
