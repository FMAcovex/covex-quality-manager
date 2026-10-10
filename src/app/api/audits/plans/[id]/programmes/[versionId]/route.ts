import { NextResponse } from "next/server";
import { getAnnualProgrammeFile } from "@/modules/audits/annual-programme/service";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await context.params;
  try {
    const file = await getAnnualProgrammeFile(id, versionId);
    return new NextResponse(new Uint8Array(file.fileData), { headers: {
      "Content-Type": file.mimeType, "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Archivo no disponible." }, { status: 404 }); }
}
