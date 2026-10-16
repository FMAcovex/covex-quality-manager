import { requireUser } from "@/lib/auth/session";
import { demoTenant } from "@/lib/auth/config";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try { const user = await requireUser(request); return Response.json({ name: user.name, roles: user.roles, grants: user.grants, demo: user.tenantId === demoTenant }, { headers }); }
  catch { return Response.json({ error: "Debe iniciar sesión." }, { status: 401, headers }); }
}
