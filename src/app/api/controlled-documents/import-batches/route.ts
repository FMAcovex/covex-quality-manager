import { listBatches } from "@/modules/controlled-documents/import/service";
export const dynamic = "force-dynamic";
export async function GET() {
    return Response.json({ batches: await listBatches() }, { headers: { "Cache-Control": "private, no-store" } });
}
