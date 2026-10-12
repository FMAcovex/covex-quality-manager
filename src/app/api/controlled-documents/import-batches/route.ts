import { authorizedRoute } from "@/lib/auth/route-guard";
import { listBatches } from "@/modules/controlled-documents/import/service";
export const dynamic = "force-dynamic";
async function GETAuthenticatedContent() {
    return Response.json({ batches: await listBatches() }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/controlled-documents/import-batches/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
