import { startLogin } from "@/lib/auth/oidc";
import { NextResponse } from "next/server";
import { logServerError } from "@/lib/log/server-log";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return await startLogin(request); }
  catch (error) { logServerError("auth.login", error); return NextResponse.redirect(new URL("/login?error=access", request.url)); }
}
