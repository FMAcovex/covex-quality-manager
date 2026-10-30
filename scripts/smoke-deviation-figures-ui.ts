import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { isolatedTestEnvironment, authConfiguration } from "../src/lib/auth/config";
import { chromium, authenticatedPage } from "./auth-fixtures/browser";

// D-125: figuras pegadas en los apartados de una desviación. Se guardan con «Adjuntar figura» como
// evidencias (aparte del botón Guardar), se numeran en todo el expediente y se ven en la ficha.
async function main() {
  assert(isolatedTestEnvironment(), "Exclusivamente base sintética aislada");
  const base = authConfiguration().origin, marker = "FIGURAS-" + randomUUID().slice(0, 8);
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  let qmsRecordId: string | null = null;
  try {
    const qa = await authenticatedPage(browser);
    qa.on("pageerror", e => errors.push(e.message));
    const go = async (path: string) => { await qa.goto(base + path); await qa.waitForLoadState("networkidle"); };
    const department = await prisma.department.findFirstOrThrow({ where: { isActive: true }, orderBy: { code: "asc" } });

    // Alta en borrador: en el alta todavía no se adjuntan figuras.
    await go("/deviations/new");
    await qa.getByText("Las figuras (imágenes pegadas en cada apartado) se añaden al editar la desviación").waitFor();
    await qa.locator('select[name="departmentId"]').selectOption(department.id);
    await qa.locator('textarea[name="whatHappened"]').fill(`${marker} etiqueta ilegible`);
    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.waitForURL(/\/deviations\/[0-9a-f-]{36}(\?|$)/, { timeout: 30000 });
    const deviation = await prisma.deviation.findFirstOrThrow({ where: { whatHappened: `${marker} etiqueta ilegible` } });
    qmsRecordId = deviation.qmsRecordId;

    await go(`/deviations/${deviation.id}/edit`);
    // Texto escrito sin guardar: adjuntar una figura no lo pierde ni guarda el formulario.
    await qa.locator('textarea[name="howHappened"]').fill("Texto sin guardar");

    // Pegar texto que también trae imagen (celdas de Excel) en un campo de texto: se pega el texto, no es figura.
    const pastedTextPrevented = await qa.locator('textarea[name="investigation"]').evaluate(async (textarea) => {
      const canvas = document.createElement("canvas"); canvas.width = 20; canvas.height = 20;
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
      const data = new DataTransfer(); data.setData("text/plain", "Lote\tTemperatura"); data.items.add(new File([blob], "celdas.png", { type: "image/png" }));
      const event = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
      textarea.dispatchEvent(event);
      return event.defaultPrevented;
    });
    assert.equal(pastedTextPrevented, false, "el texto pegado no se convierte en figura");
    await qa.waitForTimeout(300);
    assert.equal(await qa.getByAltText("Vista previa de la figura").count(), 0);

    // Pegar (Ctrl+V) una captura dentro de un campo de texto de «E. Investigación».
    await qa.locator('textarea[name="investigation"]').evaluate(async (textarea) => {
      const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 200;
      const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#c33"; ctx.fillRect(0, 0, 320, 200);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
      const data = new DataTransfer(); data.items.add(new File([blob], "captura.png", { type: "image/png" }));
      textarea.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    const investigation = qa.locator(".section-figures", { hasText: "Figuras de «E. Investigación»" });
    await investigation.getByAltText("Vista previa de la figura").waitFor();
    await investigation.getByRole("button", { name: "Adjuntar figura" }).click();
    await investigation.getByText("Describe qué muestra la figura.").waitFor();
    await investigation.getByLabel("Qué muestra la figura *").fill("Registro de temperatura con el pico");
    // Si el envío falla (red, sesión), se avisa y no se pierde lo escrito en el formulario.
    let failed = false;
    await qa.route("**/*", async (route) => {
      if (!failed && route.request().method() === "POST" && route.request().headers()["next-action"]) { failed = true; await route.abort(); return; }
      await route.continue();
    });
    await investigation.getByRole("button", { name: "Adjuntar figura" }).click();
    await investigation.getByText("No se ha podido adjuntar la figura. Inténtalo de nuevo.").waitFor();
    await qa.unroute("**/*");
    assert.equal(await qa.locator('textarea[name="howHappened"]').inputValue(), "Texto sin guardar", "un fallo no pierde lo escrito");
    // Enter en el pie adjunta la figura; no guarda el formulario de la desviación.
    await investigation.getByLabel("Qué muestra la figura *").press("Enter");
    await investigation.getByText("Figura adjuntada en «E. Investigación».").waitFor();
    assert.match(qa.url(), /\/edit(\?|$)/, "sigue en la edición");
    await investigation.getByText("Figura 1.").waitFor();

    // Elegir un archivo en «C. Descripción del evento»: es la figura 2 del expediente.
    const description = qa.locator(".section-figures", { hasText: "Figuras de «C. Descripción del evento»" });
    const png = await qa.evaluate(async () => {
      const canvas = document.createElement("canvas"); canvas.width = 120; canvas.height = 80;
      canvas.getContext("2d")!.fillRect(0, 0, 120, 80);
      return [...new Uint8Array(await (await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"))).arrayBuffer())];
    });
    await description.locator('input[type="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from(png) });
    await description.getByLabel("Qué muestra la figura *").fill("Etiqueta del lote");
    await description.getByRole("button", { name: "Adjuntar figura" }).click();
    await description.getByText("Figura 2.").waitFor();

    assert.equal(await qa.locator('textarea[name="howHappened"]').inputValue(), "Texto sin guardar", "lo escrito sin guardar se conserva");
    assert.equal((await prisma.deviation.findUniqueOrThrow({ where: { id: deviation.id } })).howHappened, null, "adjuntar una figura no guarda el formulario");

    const stored = await prisma.generatedDocument.findMany({ where: { qmsRecordId, documentType: "RECORD_EVIDENCE" }, orderBy: { generatedAt: "asc" } });
    assert.deepEqual(stored.map((row) => [(row.metadata as { section?: string }).section, (row.metadata as { description?: string }).description, row.mimeType]), [
      ["INVESTIGATION", "Registro de temperatura con el pico", "image/png"],
      ["DESCRIPTION", "Etiqueta del lote", "image/png"],
    ]);
    const history = await prisma.changeHistory.findMany({ where: { qmsRecordId, fieldPath: "__evidence__" }, orderBy: { changedAt: "asc" } });
    assert.deepEqual(history.map((row) => row.reason), ["Figura adjunta (E. Investigación): Registro de temperatura con el pico", "Figura adjunta (C. Descripción del evento): Etiqueta del lote"]);

    // La ficha muestra cada figura en su apartado, y la pestaña Evidencias las lista.
    await go(`/deviations/${deviation.id}?tab=deviation`);
    await qa.locator(".figure-block", { hasText: "Figura 1. Registro de temperatura con el pico" }).waitFor();
    await qa.locator(".figure-block", { hasText: "Figura 2. Etiqueta del lote" }).waitFor();
    const thumbnail = await qa.locator(".figure-block img").first().evaluate((img) => (img as HTMLImageElement).naturalWidth);
    assert.ok(thumbnail > 0, "la miniatura carga la imagen");
    await go(`/deviations/${deviation.id}?tab=evidence`);
    await qa.getByRole("cell", { name: "Etiqueta del lote" }).waitFor();

    assert.deepEqual(errors, []);
    console.log("D-125 OK: figuras pegadas o elegidas por apartado, adjuntadas aparte del Guardar, numeradas, en la ficha y en Evidencias.");
  } finally {
    await browser.close();
    if (qmsRecordId) {
      await prisma.changeHistory.deleteMany({ where: { qmsRecordId } });
      await prisma.generatedDocument.deleteMany({ where: { qmsRecordId } });
      await prisma.deviation.deleteMany({ where: { qmsRecordId } });
      await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId } });
      await prisma.qmsRecord.deleteMany({ where: { id: qmsRecordId } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
