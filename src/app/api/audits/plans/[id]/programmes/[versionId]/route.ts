import { authorizedRoute } from "@/lib/auth/route-guard";
import { NextResponse } from "next/server";
import { getAnnualProgrammeFile } from "@/modules/audits/annual-programme/service";
export const runtime = "nodejs";
async function GETAuthenticatedContent(_request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await context.params;
  try {
    const file = await getAnnualProgrammeFile(id, versionId);
    return new NextResponse(new Uint8Array(file.fileData), { headers: {
      "Content-Type": file.mimeType, "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Archivo no disponible." }, { status: 404 }); }
}

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/audits/plans/[id]/programmes/[versionId]/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
