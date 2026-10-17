import { NextResponse } from "next/server";
import { authorizedRoute } from "@/lib/auth/route-guard";
import { templateUnavailableResponse } from "@/lib/http/template-error-response";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { fillOosAnnexVI } from "@/modules/oos/documents/docx";
import { wordMimeType } from "@/modules/oos/documents/route-helpers";
import { loadOosTemplate } from "@/modules/oos/documents/templates";
import { getOosAnnexVIRecords } from "@/modules/oos/queries";

export const runtime = "nodejs";

/** Anexo VI: listado anual para imprimir y ratificar con firma manuscrita (§5.2); no es un documento de trabajo archivado. */
async function GETAuthenticatedContent(request: Request) {
  const year = Number(new URL(request.url).searchParams.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return NextResponse.json({ error: "Selecciona un año válido." }, { status: 400 });
  try {
    const template = await loadOosTemplate("OOS_ANNEX_VI", new Date(Date.UTC(year, 11, 31)));
    const buffer = fillOosAnnexVI(template.buffer, year, await getOosAnnexVIRecords(year));
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": wordMimeType, "Content-Disposition": `attachment; filename="Anexo_VI_Listado_general_OOS_${year}.docx"`, "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TemplateAssetError) return templateUnavailableResponse(error.message);
    throw error;
  }
}

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/oos/export/annex-vi/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
