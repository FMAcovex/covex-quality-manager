import { previewIndex } from "@/modules/controlled-documents/preview/service";
import { MAX_FILE_BYTES } from "@/modules/controlled-documents/preview/workbook";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request) {
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
        const report = await previewIndex(Buffer.from(await file.arrayBuffer()), name);
        return Response.json({ report }, { headers });
    }
    catch (error) {
        // Neither workbook contents nor database diagnostics are written to logs.
        const message = error instanceof Error && !error.name.startsWith("Prisma") ? error.message : "No se ha podido consultar el registro maestro. No se ha importado ningún dato.";
        return Response.json({ error: message }, { status: 400, headers });
    }
}
