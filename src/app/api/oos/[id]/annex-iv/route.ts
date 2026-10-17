import { authorizedRoute } from "@/lib/auth/route-guard";
import { oosAnnexResponse } from "@/modules/oos/documents/route-helpers";

export const runtime = "nodejs";

async function GETAuthenticatedContent(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return oosAnnexResponse((await params).id, "IV");
}

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/oos/[id]/annex-iv/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
