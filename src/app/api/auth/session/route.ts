import { requireUser } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try { const user = await requireUser(request); return Response.json({ name: user.name, roles: user.roles, grants: user.grants }, { headers }); }
  catch { return Response.json({ error: "Debe iniciar sesión." }, { status: 401, headers }); }
}
