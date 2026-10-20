import { authorizedRoute } from "@/lib/auth/route-guard";
import { createBatch } from "@/modules/controlled-documents/import/service";
import { previewIndex } from "@/modules/controlled-documents/preview/service";
import { MAX_FILE_BYTES } from "@/modules/controlled-documents/preview/workbook";
import { currentIdentity } from "@/lib/auth/context";
import { logServerError } from "@/lib/log/server-log";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
async function POSTAuthenticatedContent(request: Request) {
    try {
        const contentType = request.headers.get("content-type") || "";
        if (!contentType.startsWith("multipart/form-data;") || !request.body)
            return Response.json({ error: "Selecciona un archivo XLSX." }, { status: 400, headers });
        const limit = MAX_FILE_BYTES + 64 * 1024;
        if (Number(request.headers.get("content-length")) > limit)
            return Response.json({ error: "El archivo supera 8 MiB." }, { status: 413, headers });
        const reader = request.body.getReader();
        let total = 0;
        const chunks: Uint8Array[] = [];
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                total += value.byteLength;
                if (total > limit) {
                    await reader.cancel();
                    return Response.json({ error: "El archivo supera 8 MiB." }, { status: 413, headers });
                }
                chunks.push(value);
            }
        }
        finally {
            reader.releaseLock();
        }
        const body = new Uint8Array(Buffer.concat(chunks));
        const form = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body }).formData();
        const file = form.get("file");
        if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") || !file.size || file.size > MAX_FILE_BYTES)
            return Response.json({ error: "Selecciona un XLSX de hasta 8 MiB." }, { status: 400, headers });
        const name = file.name.split(/[\\/]/).pop()!.slice(0, 255);
        const buffer = Buffer.from(await file.arrayBuffer());
        if (form.get("saveBatch") === "on") {
            const actor = currentIdentity()?.principal.name;
            if (typeof actor !== "string") throw new Error("Indica el responsable del lote.");
            return Response.json({ batchId: await createBatch(buffer, name, actor, undefined, { requestId: request.headers.get("idempotency-key") ?? undefined }) }, { headers });
        }
        const report = await previewIndex(buffer, name);
        return Response.json({ report }, { headers });
    }
    catch (error) {
        // Neither workbook contents nor database diagnostics are written to logs: only the technical line of D-113.
        if (!(error instanceof Error) || error.name.startsWith("Prisma")) logServerError("controlled-documents.index-preview", error, { module: "PNT" });
        const message = error instanceof Error && !error.name.startsWith("Prisma") ? error.message : "No se ha podido consultar el registro maestro. No se ha importado ningún dato.";
        return Response.json({ error: message }, { status: 400, headers });
    }
}

export async function POST(...args: Parameters<typeof POSTAuthenticatedContent>) {
  return authorizedRoute("src/app/api/controlled-documents/index-preview/route.ts", "POST", args, authenticated => POSTAuthenticatedContent(...authenticated as Parameters<typeof POSTAuthenticatedContent>));
}
