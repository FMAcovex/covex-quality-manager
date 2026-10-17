import { NextResponse } from "next/server";
import { currentIdentity } from "@/lib/auth/context";
import { templateUnavailableResponse } from "@/lib/http/template-error-response";
import { storeWorkingDocument } from "@/lib/qms/working-document";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { fillOosAnnexIII, fillOosAnnexIV } from "@/modules/oos/documents/docx";
import { loadOosTemplate } from "@/modules/oos/documents/templates";
import { getOosDetail } from "@/modules/oos/queries";

const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, "_");
export const wordMimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Anexo III / IV de un OOS: documento de trabajo con recibo (D-088, OOS-3); la firma sigue siendo manuscrita. */
export async function oosAnnexResponse(id: string, annex: "III" | "IV") {
  const record = await getOosDetail(id);
  if (!record) return NextResponse.json({ error: "OOS no encontrado." }, { status: 404 });
  if (!record.qmsRecord.isActive) return NextResponse.json({ error: "Un OOS anulado no admite nuevas generaciones." }, { status: 409 });
  if (record.status === "DRAFT") return NextResponse.json({ error: "Los anexos no se generan mientras el OOS esté en borrador." }, { status: 409 });
  if (annex === "IV" && record.phaseIDisposition !== "FULL_SCALE") return NextResponse.json({ error: "El Anexo IV solo existe cuando la disposición de la Fase I es «Investigación a gran escala»." }, { status: 409 });
  const documentType = annex === "III" ? "OOS_ANNEX_III" : "OOS_ANNEX_IV";
  try {
    const template = await loadOosTemplate(documentType, record.issueDate);
    const buffer = annex === "III" ? fillOosAnnexIII(template.buffer, record) : fillOosAnnexIV(template.buffer, record);
    await storeWorkingDocument({ data: {
      qmsRecordId: record.qmsRecordId,
      recordVersionId: null,
      documentType,
      templateVersionId: template.templateVersionId,
      generatedByText: (currentIdentity()?.principal.name ?? process.env.DEFAULT_ACTOR_NAME) || record.createdByText,
      metadata: { source: "download", templateVersion: template.versionCode },
    } }, buffer);
    const fileName = `Anexo_${annex}_OOS_${safe(record.qmsRecord.businessCode || id)}.docx`;
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": wordMimeType, "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TemplateAssetError) return templateUnavailableResponse(error.message);
    throw error;
  }
}
