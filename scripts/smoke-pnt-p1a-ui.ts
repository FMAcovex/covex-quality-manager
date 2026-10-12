import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { assertCorporateActor, chromium } from "./auth-fixtures/browser";
import { prisma } from "../src/lib/db";
const base = process.env.P1A_UI_BASE_URL || "http://127.0.0.1:3000";
async function main() {
    const tag = randomUUID();
    const title = `P1A navegador ${tag}`;
    const actor = `P1A UI ${tag}`;
    const dep = await prisma.department.create({ data: { code: "QU-99", name: "P1A UI ficticio" } });
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(20000);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    try {
        for (let attempt = 0; attempt < 60; attempt++) {
            try {
                const r = await page.request.get(base);
                if (r.ok())
                    break;
            }
            catch { }
            if (attempt === 59)
                throw new Error("Servidor P1A no disponible");
            await new Promise(r => setTimeout(r, 1000));
        }
        await page.goto(`${base}/controlled-documents/new`);
        await assertCorporateActor(page.getByLabel("Responsable del registro", { exact: true }));
        await page.getByLabel("Título", { exact: true }).fill(title);
        await page.getByRole("button", { name: "Registrar PNT", exact: true }).click();
        await page.getByRole("alert").waitFor();
        assert.equal(await page.getByLabel("Título", { exact: true }).inputValue(), title);
        await assertCorporateActor(page.getByLabel("Responsable del registro", { exact: true }));
        assert.equal(await prisma.controlledDocument.count({ where: { createdByText: actor } }), 0);
        await page.getByLabel("Título", { exact: true }).fill("");
        await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
        await page.waitForURL(/controlled-documents\/[a-f0-9-]+$/);
        const id = page.url().split("/").pop()!;
        assert.equal((await prisma.controlledDocument.findUniqueOrThrow({ where: { id } })).baseCode, null);
        assert.equal((await prisma.controlledDocument.findUniqueOrThrow({ where: { id } })).createdByText, "Usuario sintético QA 4B1", "El nombre escrito no sustituye al actor autenticado");
        await page.getByRole("link", { name: "Editar maestro", exact: true }).click();
        await page.getByLabel("Título", { exact: true }).fill(title);
        await page.getByLabel("Código base", { exact: true }).fill("QU-99/001");
        await page.getByLabel(/^Departamento responsable/).selectOption(dep.id);
        await assertCorporateActor(page.getByLabel("Responsable del registro", { exact: true }));
        await page.getByLabel("Motivo del registro o cambio", { exact: true }).fill("Completar borrador ficticio");
        await page.getByRole("button", { name: "Completar y registrar PNT", exact: true }).click();
        await page.waitForURL(`${base}/controlled-documents/${id}`);
        await page.getByRole("link", { name: "Revisiones", exact: true }).click();
        await page.getByRole("link", { name: "Añadir revisión", exact: true }).click();
        await page.getByLabel("Revisión explícita", { exact: true }).fill("00");
        await page.getByLabel("Motivo de revisión", { exact: true }).fill("Original ficticio");
        await assertCorporateActor(page.getByLabel("Responsable del registro", { exact: true }));
        await page.getByLabel("Motivo del registro o cambio", { exact: true }).fill("Alta revisión");
        await page.getByRole("button", { name: "Guardar revisión", exact: true }).click();
        await page.waitForURL(`${base}/controlled-documents/${id}?tab=revisions`);
        const r = await prisma.controlledDocumentRevision.findFirstOrThrow({ where: { documentId: id } });
        assert.equal(r.revisionCode, "00");
        assert.equal(r.status, "DRAFT");
        await page.getByRole("link", { name: "Editar revisión en elaboración", exact: true }).click();
        await page.getByLabel("Referencia documental", { exact: true }).fill("Referencia ficticia en preparación");
        await assertCorporateActor(page.getByLabel("Responsable del registro", { exact: true }));
        await page.getByLabel("Motivo del registro o cambio", { exact: true }).fill("Actualizar borrador");
        await page.getByRole("button", { name: "Guardar revisión", exact: true }).click();
        await page.waitForURL(`${base}/controlled-documents/${id}?tab=revisions`);
        assert.equal((await prisma.controlledDocumentRevision.findFirstOrThrow({ where: { documentId: id } })).id, r.id);
        await page.getByRole("link", { name: "Documentos", exact: true }).click();
        await page.getByText("Referencia ficticia en preparación", { exact: true }).waitFor();
        await page.getByRole("link", { name: "Historial", exact: true }).click();
        await page.getByText("Actualizar borrador", { exact: true }).waitFor();
        await page.goto(`${base}/controlled-documents?q=${encodeURIComponent(title)}`);
        await page.getByRole("link", { name: "QU-99/001", exact: true }).waitFor();
        assert.deepEqual(errors, []);
        console.log("P1A navegador OK: rechazo sin perder datos, borrador incompleto, registro posterior, revisión original, edición UUID estable, documentos reales, historial y búsqueda; sin errores de hidratación.");
    }
    catch (error) {
        console.error("P1A diagnostic", page.url(), (await page.locator("body").innerText()).slice(0, 1500));
        throw error;
    }
    finally {
        await browser.close();
        const rows = await prisma.controlledDocument.findMany({ where: { departmentId: dep.id }, select: { id: true } });
        const ids = rows.map(r => r.id);
        await prisma.controlledDocumentChange.deleteMany({ where: { documentId: { in: ids } } });
        await prisma.controlledDocumentRevision.deleteMany({ where: { documentId: { in: ids } } });
        await prisma.controlledDocument.deleteMany({ where: { id: { in: ids } } });
        await prisma.department.delete({ where: { id: dep.id } });
    }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
