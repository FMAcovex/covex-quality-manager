import assert from "node:assert/strict";
import { chromium } from "./auth-fixtures/browser";
import { prisma } from "../src/lib/db";
import { previewFixture } from "../src/modules/controlled-documents/preview/synthetic-workbook";
const base = process.env.P1B2_UI_BASE_URL || "http://127.0.0.1:3000", actor = "P1B-2 navegador QA ficticio";
async function main() {
    if (process.env.APP_ENV !== "test") throw new Error("QA aislado requerido.");
    const gc = await prisma.department.findUniqueOrThrow({where:{code:"GC-00"}});
    const browser = await chromium.launch({headless:true}), page = await browser.newPage(); page.setDefaultTimeout(20000);
    const errors: string[] = []; page.on("pageerror",e=>errors.push(e.message)); let batchId: string | null = null;
    try {
        for (let attempt=0;attempt<60;attempt++) { try { if ((await page.request.get(`${base}/controlled-documents/import-index`)).ok()) break; } catch {} if (attempt === 59) throw new Error("Servidor no disponible"); await new Promise(r=>setTimeout(r,1000)); }
        await page.goto(`${base}/controlled-documents/import-index`);
        await page.getByLabel("Excel del índice maestro",{exact:true}).setInputFiles({name:"synthetic.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer:previewFixture()});
        await page.getByRole("button",{name:"Analizar Excel",exact:true}).click(); await page.getByRole("heading",{name:"Resumen",exact:true}).waitFor();
        await page.getByLabel("Responsable del lote",{exact:true}).fill(actor); await page.getByRole("button",{name:"Guardar previsualización como lote pendiente",exact:true}).click();
        await page.waitForURL(/\/import-index\/[a-f0-9-]{36}$/); batchId = page.url().split("/").pop()!;
        await page.getByRole("heading",{name:"Conciliación del lote",exact:true}).waitFor();
        assert.equal((await prisma.controlledDocumentImportBatch.findUniqueOrThrow({where:{id:batchId}})).state,"PENDING");
        await page.reload(); await page.getByRole("heading",{name:"Conciliación del lote",exact:true}).waitFor();
        assert.equal(await page.getByRole("heading",{name:/GC-00\/999/}).count(),0);
        await page.getByLabel("Buscar candidatos",{exact:true}).fill("GC-00/002"); const article = page.locator("article.form-section"); assert.equal(await article.count(),1);
        await article.getByLabel(/^Correspondencia de departamento/).selectOption(gc.id);
        await article.getByLabel(/^Decisión de la fila/).selectOption("INCLUDE");
        await article.getByLabel("Motivo y resolución de incidencias",{exact:true}).fill("Revisión 00 y datos originales contrastados QA");
        await article.getByRole("checkbox").check();
        const decisionResponse = page.waitForResponse(r=>r.url().endsWith(`/import-batches/${batchId}`) && r.request().method() === "POST"); await article.getByRole("button",{name:"Guardar decisión",exact:true}).click(); assert.equal((await decisionResponse).status(),200);
        await page.getByText(/Decidido por/).waitFor();
        await page.getByRole("button",{name:"Revisar propuesta de importación",exact:true}).click(); await page.getByRole("heading",{name:"Confirmación explícita",exact:true}).waitFor();
        const confirmButton = page.getByRole("button",{name:"Confirmar importación",exact:true}); assert.equal(await confirmButton.isDisabled(),true);
        await page.getByRole("checkbox",{name:"Confirmo expresamente esta propuesta y únicamente sus filas elegibles.",exact:true}).check();
        const confirmedResponse = page.waitForResponse(r=>r.url().endsWith(`/import-batches/${batchId}`) && r.request().method() === "POST"); await confirmButton.click(); assert.equal((await confirmedResponse).status(),200);
        await article.getByText(/Resultado: CREATED/).waitFor(); assert.equal(await confirmButton.count(),0);
        const master = await prisma.controlledDocument.findUniqueOrThrow({where:{baseCode:"GC-00/002"},include:{revisions:true}}); assert.equal(master.revisions[0].status,"IMPORTED_PENDING"); assert.equal(master.revisions[0].consolidatedAt,null);
        const snapshot = JSON.stringify(master);
        await article.getByRole("link",{name:"Consultar PNT",exact:true}).click();
        await page.getByText(/Importado del índice: pendiente de verificación documental/).waitFor();
        await page.getByRole("link",{name:"Revisiones",exact:true}).click();
        const revisionCard = page.locator("article.form-section").filter({has: page.getByRole("heading",{name:"GC-00/002/00",exact:true})});
        await revisionCard.getByText("Importada / pendiente de verificación",{exact:true}).waitFor();
        await page.getByRole("link",{name:"Documentos",exact:true}).click(); await page.getByText("Sin verificar",{exact:true}).waitFor();
        await page.goto(`${base}/controlled-documents?q=GC-00%2F002&revisionState=IMPORTED_PENDING`); await page.getByText(/Vigente según índice/).first().waitFor();
        assert.equal(JSON.stringify(await prisma.controlledDocument.findUniqueOrThrow({where:{id:master.id},include:{revisions:true}})),snapshot);
        await page.goto(`${base}/controlled-documents/import-index/${batchId}`); await page.getByLabel("Buscar candidatos",{exact:true}).fill("MC-20/001");
        const groupArticle = page.locator("article.form-section").first(); await groupArticle.getByLabel(/^Decisión de la fila/).selectOption("EXCLUDED"); await groupArticle.getByLabel(/^Alcance de la decisión/).selectOption("GROUP"); await groupArticle.getByLabel("Motivo y resolución de incidencias",{exact:true}).fill("Excluir grupo contradictorio hasta evidencia");
        const groupResponse = page.waitForResponse(r=>r.url().endsWith(`/import-batches/${batchId}`) && r.request().method() === "POST"); await groupArticle.getByRole("button",{name:"Guardar decisión",exact:true}).click(); assert.equal((await groupResponse).status(),200);
        await groupArticle.getByText(/Decidido por/).waitFor(); const batch = await prisma.controlledDocumentImportBatch.findUniqueOrThrow({where:{id:batchId},include:{rows:true}}); assert.equal(batch.rows.filter(r=>r.baseCode === "MC-20/001" && r.decision === "EXCLUDED").length,2); assert.equal(batch.state,"PARTIAL");
        await page.getByRole("link",{name:"Volver a lotes",exact:true}).click(); await page.getByRole("link",{name:`synthetic.xlsx — ${batchId}`,exact:true}).click(); await page.getByRole("heading",{name:"Resultado e historial operativo del lote",exact:true}).waitFor();
        assert.deepEqual(errors,[]);
        console.log("P1B-2 navegador OK: guardar/recuperar, resolver, grupos, propuesta y confirmación explícita, parcial, resultado/historial, ficha/listado y estados separados; sin errores de hidratación.");
    } finally {
        await browser.close();
        const docs = await prisma.controlledDocument.findMany({where:{createdByText:actor},select:{id:true}}); const ids = docs.map(d=>d.id);
        await prisma.controlledDocumentChange.deleteMany({where:{documentId:{in:ids}}}); await prisma.controlledDocumentRevision.deleteMany({where:{documentId:{in:ids}}}); await prisma.controlledDocument.deleteMany({where:{id:{in:ids}}});
        if (batchId) { await prisma.controlledDocumentImportEvent.deleteMany({where:{batchId}}); await prisma.controlledDocumentImportRow.deleteMany({where:{batchId}}); await prisma.controlledDocumentImportBatch.delete({where:{id:batchId}}); }
    }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
