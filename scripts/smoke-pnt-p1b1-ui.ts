import assert from "node:assert/strict";
import { chromium } from "./auth-fixtures/browser";
import { prisma } from "../src/lib/db";
import { previewFixture } from "../src/modules/controlled-documents/preview/synthetic-workbook";
const base = process.env.P1B1_UI_BASE_URL || "http://127.0.0.1:3000";
async function snapshot() { return JSON.stringify(await Promise.all([prisma.controlledDocument.findMany({ orderBy: { id: "asc" } }), prisma.controlledDocumentRevision.findMany({ orderBy: { id: "asc" } }), prisma.controlledDocumentChange.findMany({ orderBy: { id: "asc" } }), prisma.department.findMany({ orderBy: { id: "asc" } })])); }
async function main() {
    const browser = await chromium.launch({ headless: true }), page = await browser.newPage();
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(20000);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    try {
        for (let attempt = 0; attempt < 60; attempt++) {
            try {
                if ((await page.request.get(`${base}/controlled-documents/import-index`)).ok())
                    break;
            }
            catch { }
            if (attempt === 59)
                throw new Error("Servidor P1B-1 no disponible");
            await new Promise(r => setTimeout(r, 1000));
        }
        const before = await snapshot();
        await page.goto(`${base}/controlled-documents`);
        await page.getByRole("link", { name: "Importar índice maestro", exact: true }).click();
        await page.waitForURL(`${base}/controlled-documents/import-index`);
        await page.getByLabel("Excel del índice maestro", { exact: true }).setInputFiles({ name: "synthetic.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: previewFixture() });
        await page.getByRole("button", { name: "Analizar Excel", exact: true }).click();
        await page.getByRole("heading", { name: "Resumen", exact: true }).waitFor();
        assert.equal(await page.getByRole("button", { name: /Importar definitivamente|Confirmar importación/ }).count(), 0);
        const rows = page.locator("tbody tr");
        assert.equal(await rows.count(), 9);
        await page.getByLabel("Buscar código o título", { exact: true }).fill("GC-00/001");
        assert.equal(await rows.count(), 1);
        assert.ok((await rows.innerText()).includes("GC-00("));
        assert.ok((await rows.innerText()).includes("03"));
        assert.equal((await rows.innerText()).includes("Fuente inválida"), false);
        await page.getByLabel("Buscar código o título", { exact: true }).fill("GC-00/999");
        assert.equal(await rows.count(), 0);
        await page.getByLabel("Buscar código o título", { exact: true }).fill("");
        await page.getByLabel(/^Incidencia/).selectOption("REVISION_DISCREPANCY");
        assert.equal(await rows.count(), 2);
        await page.getByLabel(/^Incidencia/).selectOption("");
        await page.getByLabel(/^Conciliación/).selectOption("NOT_IMPORTABLE");
        assert.ok(await rows.count() > 0);
        await page.getByLabel(/^Conciliación/).selectOption("");
        await page.locator("tbody details").first().locator("summary").click();
        await page.getByText("Verificación del índice: sin verificar documentalmente.", { exact: true }).first().waitFor();
        assert.equal(await snapshot(), before);
        assert.deepEqual(errors, []);
        await page.getByLabel("Excel del índice maestro", { exact: true }).setInputFiles({ name: "invalid.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("invalid") });
        await page.getByRole("button", { name: "Analizar Excel", exact: true }).click();
        await page.getByRole("alert").filter({ hasText: "El XLSX no es válido" }).waitFor();
        assert.equal(await snapshot(), before);
        console.log("P1B-1 navegador OK: carga/análisis, resumen, filtros, procedencia GC-00(, exclusión GC-00 y código exclusivo descartado, valores originales, sin botón definitivo, rechazo de XLSX inválido; cero escrituras operativas.");
    }
    finally {
        await browser.close();
    }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
