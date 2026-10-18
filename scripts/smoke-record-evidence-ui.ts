import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { type Page } from "playwright";
import { chromium } from "./auth-fixtures/browser";
import { prisma } from "../src/lib/db";

// D-096: evidencias adjuntas a un expediente desde la interfaz real (sobre un borrador OOS ficticio).
const base = process.env.OOS_UI_BASE_URL;
const marker = `EVIDENCIA-UI-${randomUUID()}`;
const ids: string[] = [];
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);

async function view(page: Page, path: string) {
  await page.goto(`${base}${path}`);
  await page.waitForLoadState("networkidle");
}

async function attach(page: Page, description: string, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.locator('.evidence-form [name="description"]').fill(description);
  await page.locator('.evidence-form [name="reference"]').fill("Seguimiento 1 (ficticio)");
  await page.locator('.evidence-form [name="file"]').setInputFiles(file);
  await page.getByRole("button", { name: "Adjuntar evidencia", exact: true }).click();
}

async function main() {
  if (process.env.APP_ENV !== "test" || !base) throw new Error("APP_ENV=test y OOS_UI_BASE_URL son obligatorios.");
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Madrid" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await view(page, "/oos/new");
    await page.locator('[name="materialName"]').fill(marker);
    await page.locator('[name="issueDate"]').fill("2096-04-10");
    await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
    await page.waitForURL(/\/oos\/[0-9a-f-]{36}$/, { timeout: 30000 });
    const record = await prisma.oosRecord.findFirstOrThrow({ where: { materialName: marker } });
    ids.push(record.qmsRecordId);

    await view(page, `/oos/${record.id}?tab=evidence`);
    await page.getByText("Este expediente no tiene evidencias adjuntas.").waitFor();

    // Una imagen falsa se rechaza en servidor y no deja rastro.
    await attach(page, "Imagen no válida", { name: "falsa.png", mimeType: "image/png", buffer: Buffer.from("no es una imagen") });
    await page.getByText("El contenido de la imagen no corresponde a su extensión.").waitFor();
    assert.equal(await prisma.generatedDocument.count({ where: { qmsRecordId: record.qmsRecordId } }), 0);

    await attach(page, "Fotografía del etiquetado del lote", { name: "etiqueta lote.png", mimeType: "image/png", buffer: png });
    await page.getByText("Evidencia «etiqueta lote.png» adjuntada.").waitFor();
    const stored = await prisma.generatedDocument.findFirstOrThrow({ where: { qmsRecordId: record.qmsRecordId } });
    assert.equal(stored.documentType, "RECORD_EVIDENCE");
    assert.equal(stored.fileName, "etiqueta_lote.png");
    assert.equal(stored.mimeType, "image/png");
    assert.equal(stored.checksum, createHash("sha256").update(png).digest("hex"));
    assert.equal(stored.generatedByText, await page.locator('.evidence-form [name="actor"]').inputValue());
    const history = await prisma.changeHistory.findFirstOrThrow({ where: { qmsRecordId: record.qmsRecordId, fieldPath: "__evidence__" } });
    assert.match(history.reason ?? "", /Fotografía del etiquetado del lote/);

    await view(page, `/oos/${record.id}?tab=evidence`);
    await page.getByRole("cell", { name: "Fotografía del etiquetado del lote" }).waitFor();
    const href = await page.getByRole("link", { name: "etiqueta_lote.png" }).getAttribute("href");
    assert.equal(href, `/api/qms/${record.qmsRecordId}/evidence/${stored.id}`);
    const download = await page.request.get(`${base}${href}`);
    assert.equal(download.status(), 200);
    assert.equal(download.headers()["x-checksum-sha256"], stored.checksum);
    assert.equal(download.headers()["x-content-type-options"], "nosniff");
    assert.match(download.headers()["content-disposition"] ?? "", /attachment; filename="etiqueta_lote.png"/);
    assert.deepEqual(Buffer.from(await download.body()), png);
    // Una evidencia de otro expediente no se sirve por esta ruta.
    assert.equal((await page.request.get(`${base}/api/qms/${record.qmsRecordId}/evidence/${randomUUID()}`)).status(), 404);

    // La evidencia no aparece entre los documentos generados ni rompe la cronología.
    await view(page, `/oos/${record.id}?tab=timeline`);
    await page.getByText("Evidencia adjunta").first().waitFor();
    assert.deepEqual(errors, []);
    console.log("Smoke evidencias adjuntas (D-096): OK");
  } finally {
    await browser.close();
    await prisma.generatedDocument.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.changeHistory.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.oosRecord.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
  }
}

main().finally(() => prisma.$disconnect()).catch((error) => {
  console.error(error);
  process.exit(1);
});
