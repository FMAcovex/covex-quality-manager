import "./auth-fixtures/context";
import "server-only";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

// BE1-A (D-112): con el cliente de la aplicación, listados, fichas y formularios no leen bytes de fichero;
// las descargas, la carga de plantillas para generar Word y los documentos guardados siguen íntegros.
function hasBinary(value: unknown): boolean {
  if (!value || typeof value !== "object" || value instanceof Date) return false;
  return Object.entries(value).some(([key, item]) => key === "fileData" || hasBinary(item));
}

async function main() {
  const sql: string[] = [];
  const { createAppPrismaClient } = await import("../src/lib/db-client");
  const client = createAppPrismaClient({ log: [{ emit: "event", level: "query" }], onQuery: event => sql.push(event.query) });
  (globalThis as unknown as { prisma: PrismaClient }).prisma = client;
  const { prisma } = await import("../src/lib/db");
  const { withBytes } = await import("../src/lib/db-binary-omit");
  const { createBe1Fixtures } = await import("./be1-fixtures");
  const deviations = await import("../src/modules/deviations/queries");
  const capa = await import("../src/modules/capa/queries");
  const changes = await import("../src/modules/change-control/queries");
  const complaints = await import("../src/modules/complaints/queries");
  const returns = await import("../src/modules/returns/queries");
  const audits = await import("../src/modules/audits/queries");
  const oos = await import("../src/modules/oos/queries");
  const pnt = await import("../src/modules/controlled-documents/listing");
  const { loadStoredTemplateAsset } = await import("../src/modules/configuration/template-assets");
  const { storeWorkingDocument } = await import("../src/lib/qms/working-document");
  const { getAuditDocument } = await import("../src/modules/audits/documents/service");
  const devPdf = await import("../src/app/api/deviations/[id]/versions/[sequence]/signed-pdf/route");
  const capaPdf = await import("../src/app/api/capa/[id]/versions/[sequence]/signed-pdf/route");
  const changePdf = await import("../src/app/api/changes/[id]/versions/[sequence]/signed-pdf/route");
  const complaintPdf = await import("../src/app/api/complaints/[id]/versions/[sequence]/signed-pdf/route");
  const returnPdf = await import("../src/app/api/returns/[id]/signed-pdf/[annex]/route");
  const oosPdf = await import("../src/app/api/oos/[id]/signed-pdf/[annex]/route");
  const returnArchive = await import("../src/app/api/returns/[id]/documents/[documentId]/route");
  const templateDownload = await import("../src/app/api/settings/templates/[id]/download/route");
  const evidence = await import("../src/app/api/qms/[id]/evidence/[documentId]/route");

  const fixture = await createBe1Fixtures(60);
  const request = new Request("http://127.0.0.1/synthetic-download");
  let downloads = 0;
  const same = (bytes: Uint8Array | Buffer, label: string) => {
    assert.deepEqual(Buffer.from(bytes), fixture.bytes, `${label}: mismos bytes`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), fixture.checksum, `${label}: mismo SHA-256`);
  };
  const verify = async (response: Response, label: string) => {
    assert.equal(response.status, 200, `${label}: HTTP 200`);
    same(Buffer.from(await response.arrayBuffer()), label);
    downloads++;
  };
  try {
    const d = fixture.binaryDetail;
    const reads: [string, () => Promise<unknown>][] = [
      ["listado Desviaciones", () => deviations.getDeviationList({})], ["listado CAPA", () => capa.getCapaList({})],
      ["listado Cambios", () => changes.getChangeControlList({})], ["listado Reclamaciones", () => complaints.getComplaintList({})],
      ["listado Devoluciones", () => returns.getReturnList({})], ["listado Auditorías", () => audits.getAuditList({ signedPdf: "yes" })],
      ["listado OOS", () => oos.getOosList({})], ["índice PNT", () => pnt.queryPntListing({ q: fixture.prefix })],
      ["ficha Desviación", () => deviations.getDeviationDetail(d.deviation)], ["ficha CAPA", () => capa.getCapaDetail(d.capa)],
      ["ficha Cambio", () => changes.getChangeControlDetail(d.change)], ["ficha Reclamación", () => complaints.getComplaintDetail(fixture.ids[3][1])],
      ["ficha Devolución", () => returns.getReturnDetail(fixture.ids[4][1])], ["ficha Auditoría", () => audits.getAuditDetail(d.audit)],
      ["ficha OOS", () => oos.getOosDetail(d.oos)],
      ["formulario Desviación", () => deviations.getDeviationFormLookups()], ["formulario CAPA", () => capa.getCapaLookups()],
      ["formulario Cambio", () => changes.getChangeControlLookups()],
    ];
    for (const [label, read] of reads) {
      sql.length = 0;
      const result = await read();
      assert(!sql.some(query => query.includes('"fileData"')), `${label}: ningún SQL lee "fileData"`);
      assert(!hasBinary(result), `${label}: el resultado no lleva bytes`);
    }
    const generated = await prisma.generatedDocument.findFirstOrThrow({ where: { templateVersionId: { in: fixture.templateIds } } });
    assert(!Object.hasOwn(generated, "fileData"), "Por defecto, una fila de documento no trae los bytes");
    same((await prisma.generatedDocument.findUniqueOrThrow({ where: { id: generated.id }, omit: withBytes })).fileData!, "omit: withBytes");

    // Descargas: los bytes y el checksum originales.
    const signedSequence = async (qmsRecordId: string) => (await prisma.qmsRecordVersion.findFirstOrThrow({ where: { qmsRecordId, documents: { some: {} } }, orderBy: { sequenceNumber: "desc" } })).sequenceNumber;
    const qmsOf = async (model: "deviation" | "capa" | "changeControl", id: string) => (await (prisma[model] as unknown as { findUniqueOrThrow(a: object): Promise<{ qmsRecordId: string }> }).findUniqueOrThrow({ where: { id }, select: { qmsRecordId: true } })).qmsRecordId;
    for (const [route, model, id, label] of [[devPdf, "deviation", d.deviation, "PDF firmado Desviación"], [capaPdf, "capa", d.capa, "PDF firmado CAPA"], [changePdf, "changeControl", d.change, "PDF firmado Cambio"]] as const) {
      const sequence = await signedSequence(await qmsOf(model, id));
      await verify(await route.GET(request, { params: Promise.resolve({ id, sequence: String(sequence) }) }), label);
    }
    const complaintRecord = await complaints.getComplaintDetail(fixture.ids[3][1]);
    await verify(await complaintPdf.GET(request, { params: Promise.resolve({ id: fixture.ids[3][1], sequence: String(complaintRecord!.qmsRecord.versions.at(-1)!.sequenceNumber) }) }), "PDF firmado Reclamación");
    for (const annex of ["annex-iii", "annex-v"]) await verify(await returnPdf.GET(request, { params: Promise.resolve({ id: fixture.ids[4][1], annex }) }), `PDF firmado Devolución ${annex}`);
    await verify(await oosPdf.GET(request, { params: Promise.resolve({ id: d.oos, annex: "annex-iii" }) }), "PDF firmado OOS");
    const returned = await returns.getReturnDetail(fixture.ids[4][1]);
    for (const document of returned!.qmsRecord.generatedDocuments) await verify(await returnArchive.GET(request, { params: Promise.resolve({ id: fixture.ids[4][1], documentId: document.id }) }), "archivo Devolución");
    for (const id of fixture.templateIds) await verify(await templateDownload.GET(request, { params: Promise.resolve({ id }) }), "descarga de plantilla");
    const auditQms = (await prisma.audit.findUniqueOrThrow({ where: { id: d.audit }, select: { qmsRecordId: true } })).qmsRecordId;
    const auditDocument = await prisma.generatedDocument.findFirstOrThrow({ where: { qmsRecordId: auditQms, templateVersionId: { in: fixture.templateIds } } });
    same((await getAuditDocument(d.audit, auditDocument.id)).fileData!, "documento de Auditoría");

    // Generación de Word: la plantilla llega con sus bytes verificados.
    const template = await prisma.templateVersion.findFirstOrThrow({ where: { id: { in: fixture.templateIds }, module: "DEVIATION", isActive: true } });
    same((await loadStoredTemplateAsset(template.module, template.documentType, template.versionCode))!, "plantilla para generar Word");

    // Un documento guardado conserva sus bytes y su checksum, y se descarga como evidencia.
    const devQms = await qmsOf("deviation", d.deviation);
    const stored = await storeWorkingDocument({ data: { qmsRecordId: devQms, documentType: "RECORD_EVIDENCE", fileName: "evidencia-be1a.pdf", mimeType: "application/pdf",
      fileData: new Uint8Array(fixture.bytes), checksum: fixture.checksum, generatedByText: "Actor sintético BE1", templateVersionId: template.id, metadata: { fictitious: true } } });
    same((await prisma.generatedDocument.findUniqueOrThrow({ where: { id: stored.id }, omit: withBytes })).fileData!, "documento guardado");
    await verify(await evidence.GET(request, { params: Promise.resolve({ id: devQms, documentId: stored.id }) }), "descarga de evidencia");
    console.log(`BE1-A OK: 0 bytes en ${reads.length} listados/fichas/formularios; ${downloads} descargas, plantilla para Word y documentos guardados íntegros.`);
  } finally {
    await fixture.cleanup();
    await client.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
