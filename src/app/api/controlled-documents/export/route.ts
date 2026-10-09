import { generateSimpleXlsx } from "@/lib/ooxml/simple-xlsx";
import { administrativeLabels, revisionLabels } from "@/modules/controlled-documents/domain";
import { manualStateLabels } from "@/modules/controlled-documents/manual-state/domain";
import { operationalDates, queryPntListing, type PntListingFilters } from "@/modules/controlled-documents/listing";
export const runtime = "nodejs";

export async function GET(request: Request) {
 const url = new URL(request.url);
 const filters = Object.fromEntries(url.searchParams.entries()) as PntListingFilters;
 const result = await queryPntListing(filters, false);
 if (result.errors.length) return Response.json({ error: result.errors.join(" ") }, { status: 400 });
 const rows = result.rows.map(({master,revision}) => {
  const dates = revision ? operationalDates(revision) : null;
  return [
   master.baseCode || "", master.title || "", master.departmentCodeSnapshot || "",
   master.departmentNameSnapshot || "", administrativeLabels[master.administrativeStatus],
   revision?.revisionCode || "",
   revision ? manualStateLabels[revision.status as keyof typeof manualStateLabels] || revisionLabels[revision.status] : "",
   dates?.effectiveFrom || "", dates?.reviewDueAt || "",
   revision?.verificationStatus || "",
  ].map(value => /^[=+\-@\t\r]/.test(value) ? "'" + value : value);
 });
 const output = generateSimpleXlsx("PNT filtrados", [
  "Código","Título","Código departamento","Departamento","Estado maestro","Revisión",
  "Estado documental","Fecha de vigencia","Próxima revisión","Verificación documental",
 ], rows);
 return new Response(new Uint8Array(output), { headers: {
  "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "Content-Disposition": 'attachment; filename="COVEX_PNT_listado_filtrado.xlsx"',
  "Cache-Control": "private, no-store",
 } });
}
