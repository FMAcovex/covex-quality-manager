import { authorizedRoute } from "@/lib/auth/route-guard";
import { z } from "zod";
import { getBatch, decide, prepare, confirm } from "@/modules/controlled-documents/import/service";
import { decisionSchema, actorSchema } from "@/modules/controlled-documents/import/domain";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const confirmation = z.object({ actor: actorSchema, version: z.number().int().nonnegative(), token: z.string().regex(/^[a-f0-9]{64}$/), eligibleKeys: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(100000), explicitlyConfirmed: z.literal(true) });
async function idValue(params: Promise<{id: string}>) { return z.string().uuid().parse((await params).id); }
function failure(error: unknown) {
    const message = error instanceof z.ZodError ? "Datos de conciliación incompletas o inválidas." : error instanceof Error && !error.name.startsWith("Prisma") ? error.message : "No se ha podido completar la operación. Recupera el lote y revisa la propuesta.";
    return Response.json({ error: message }, { status: 400, headers });
}
async function GETAuthenticatedContent(_: Request, { params }: {params: Promise<{id: string}>}) {
    try { return Response.json({ batch: await getBatch(await idValue(params)) }, { headers }); } catch (e) { return failure(e); }
}
async function POSTAuthenticatedContent(request: Request, { params }: {params: Promise<{id: string}>}) {
    try {
        // Bound JSON reads independently of Content-Length; never accept browser-supplied workbook reports.
        if (!request.body) throw new Error("Falta la solicitud.");
        const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
        try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 8 * 1024 * 1024) { await reader.cancel(); throw new Error("Solicitud demasiado grande."); } chunks.push(part.value); } } finally { reader.releaseLock(); }
        const v = JSON.parse(Buffer.concat(chunks).toString("utf8")), id = await idValue(params);
        if (v.operation === "DECIDE") { await decide(id, decisionSchema.parse(v.input)); return Response.json({ batch: await getBatch(id) }, { headers }); }
        if (v.operation === "PREPARE") return Response.json({ plan: await prepare(id, undefined, actorSchema.parse(v.input?.actor)) }, { headers });
        if (v.operation === "CONFIRM") return Response.json({ result: await confirm(id, confirmation.parse(v.input)), batch: await getBatch(id) }, { headers });
        throw new Error("Operación desconocida.");
    } catch (e) { return failure(e); }
}

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/controlled-documents/import-batches/[id]/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}

export async function POST(...args: Parameters<typeof POSTAuthenticatedContent>) {
  return authorizedRoute("src/app/api/controlled-documents/import-batches/[id]/route.ts", "POST", args, authenticated => POSTAuthenticatedContent(...authenticated as Parameters<typeof POSTAuthenticatedContent>));
}
