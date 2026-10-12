import { authorizedRoute } from "@/lib/auth/route-guard";
import { generateSimpleXlsx } from "@/lib/ooxml/simple-xlsx";
import { administrativeLabels, verificationLabels } from "@/modules/controlled-documents/domain";
import { documentStateLabel } from "@/modules/controlled-documents/presentation";
import { operationalDates, queryPntListing, type PntListingFilters } from "@/modules/controlled-documents/listing";
export const runtime = "nodejs";

async function GETAuthenticatedContent(request: Request) {
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
   revision ? documentStateLabel(revision.status) : "",
   dates?.effectiveFrom || "", dates?.reviewDueAt || "",
   revision ? verificationLabels[revision.verificationStatus] : "",
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

export async function GET(...args: Parameters<typeof GETAuthenticatedContent>) {
  return authorizedRoute("src/app/api/controlled-documents/export/route.ts", "GET", args, authenticated => GETAuthenticatedContent(...authenticated as Parameters<typeof GETAuthenticatedContent>));
}
