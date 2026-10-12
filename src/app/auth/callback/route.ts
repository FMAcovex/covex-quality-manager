import { finishLogin } from "@/lib/auth/oidc";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return await finishLogin(request); }
  catch { return NextResponse.redirect(new URL("/login?error=access", request.url)); }
}
