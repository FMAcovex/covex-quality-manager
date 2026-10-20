import { NextResponse } from "next/server";
import { buildEndSessionUrl } from "openid-client";
import { prisma } from "@/lib/db";
import { authConfiguration } from "@/lib/auth/config";
import { providerConfiguration } from "@/lib/auth/oidc";
import { cookieNames, hash, requestCookie, requireCsrf, requireUser } from "@/lib/auth/session";
import { logServerError } from "@/lib/log/server-log";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    await requireUser(request);
    let form: FormData | undefined;
    if (request.headers.get("content-type")?.includes("application/x-www-form-urlencoded") && request.body) {
      const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
      try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 4096) { await reader.cancel(); throw new Error("Invalid request"); } chunks.push(part.value); } } finally { reader.releaseLock(); }
      form = new FormData(); for (const [key, value] of new URLSearchParams(Buffer.concat(chunks).toString("utf8"))) form.append(key, value);
    }
    await requireCsrf(request, form);
    const names = cookieNames(), config = authConfiguration();
    await prisma.authSession.updateMany({ where: { tokenHash: hash(requestCookie(request, names.session)), revokedAt: null }, data: { revokedAt: new Date() } });
    let location = new URL("/login", config.origin);
    try { location = buildEndSessionUrl(await providerConfiguration(), { post_logout_redirect_uri: config.origin + "/login", client_id: config.clientId }); } catch { /* Local revocation remains effective when the provider is unavailable. */ }
    const response = NextResponse.redirect(location, 303);
    for (const name of Object.values(names)) response.cookies.set(name, "", { secure: config.secure, httpOnly: name !== names.csrf, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) { logServerError("auth.logout", error); return Response.json({ error: "Solicitud no autorizada." }, { status: 403 }); }
}
