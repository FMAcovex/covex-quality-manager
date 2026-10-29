import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { isolatedTestEnvironment, authConfiguration } from "../src/lib/auth/config";
import { chromium, authenticatedPage } from "./auth-fixtures/browser";

// D-123: 5 porqués, Ishikawa (6M) y brainstorming en la investigación de una Desviación.
// Solo una causa confirmada pasa a «Causa raíz», con un clic; se guarda con el expediente y
// guardar sin tocarlas no las anota como cambio.
async function main() {
  assert(isolatedTestEnvironment(), "Exclusivamente base sintética aislada");
  const base = authConfiguration().origin, marker = "HERRAMIENTAS-" + randomUUID().slice(0, 8);
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  let qmsRecordId: string | null = null;
  try {
    const qa = await authenticatedPage(browser);
    qa.on("pageerror", e => errors.push(e.message));
    const go = async (path: string) => { await qa.goto(base + path); await qa.waitForLoadState("networkidle"); };
    const department = await prisma.department.findFirstOrThrow({ where: { isActive: true }, orderBy: { code: "asc" } });

    await go("/deviations/new");
    await qa.locator('select[name="departmentId"]').selectOption(department.id);
    await qa.locator('textarea[name="whatHappened"]').fill(`${marker} etiqueta errónea`);
    const tools = qa.locator("details.investigation-tools");
    await tools.locator("summary").click();

    // 5 porqués.
    await tools.getByLabel("Problema").fill("Etiqueta errónea en el lote");
    await tools.getByLabel("¿Por qué? 1").fill("Se usó la plantilla anterior");
    await tools.getByLabel("¿Por qué? 2").fill("La plantilla anterior seguía disponible en el sistema");

    // Ishikawa: una hipótesis no se puede usar; confirmada sí.
    await tools.getByRole("button", { name: "+ Añadir causa en Método" }).click();
    const cause = tools.locator(".investigation-cause-row").first();
    await cause.locator("textarea").first().fill(`${marker} instrucción sin verificación de plantilla`);
    await cause.locator("textarea").nth(1).fill("Revisión del PNT de etiquetado");
    const use = cause.getByRole("button", { name: "Usar como causa raíz" });
    assert.equal(await use.isDisabled(), true, "una hipótesis no se puede usar como causa raíz");
    await cause.locator("select").selectOption("CONFIRMED");
    assert.equal(await use.isDisabled(), false);
    await use.click();
    assert.equal(await qa.locator('textarea[name="rootCause"]').inputValue(), `${marker} instrucción sin verificación de plantilla`);
    assert.equal(await qa.locator('input[name="rootCauseCategories"][value="METHOD"]').isChecked(), true, "propone la categoría 6M");
    assert.equal(await qa.locator('input[name="investigationMethods"][value="ISHIKAWA"]').isChecked(), true, "marca la herramienta usada");
    await qa.getByRole("status").filter({ hasText: "Copiado a «Causa raíz»" }).waitFor({ state: "attached" });
    // Pulsarlo dos veces no duplica el texto.
    await use.click();
    assert.equal(await qa.locator('textarea[name="rootCause"]').inputValue(), `${marker} instrucción sin verificación de plantilla`);

    // Brainstorming: una idea descartada con su categoría opcional.
    await tools.getByRole("button", { name: "+ Añadir idea" }).click();
    const idea = tools.locator(".investigation-cause-row.with-category").first();
    await idea.locator("textarea").first().fill("Cambio de turno durante el etiquetado");
    await idea.locator("select").first().selectOption("PEOPLE");
    await idea.locator("select").nth(1).selectOption("DISCARDED");

    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.waitForURL(/\/deviations\/[0-9a-f-]{36}(\?|$)/, { timeout: 30000 });
    const saved = await prisma.deviation.findFirstOrThrow({ where: { whatHappened: `${marker} etiqueta errónea` } });
    qmsRecordId = saved.qmsRecordId;
    assert.deepEqual(saved.investigationTools, {
      fiveWhys: { problem: "Etiqueta errónea en el lote", whys: ["Se usó la plantilla anterior", "La plantilla anterior seguía disponible en el sistema"], status: "HYPOTHESIS" },
      causes: [
        { method: "ISHIKAWA", category: "METHOD", text: `${marker} instrucción sin verificación de plantilla`, evidence: "Revisión del PNT de etiquetado", status: "CONFIRMED" },
        { method: "BRAINSTORMING", category: "PEOPLE", text: "Cambio de turno durante el etiquetado", evidence: "", status: "DISCARDED" },
      ],
    });
    assert.equal(saved.rootCause, `${marker} instrucción sin verificación de plantilla`);
    assert.deepEqual(saved.rootCauseCategories, ["METHOD"]);

    // La ficha las muestra en la investigación, con su estado.
    await go(`/deviations/${saved.id}?tab=deviation`);
    const summary = qa.locator(".investigation-tools-summary");
    await summary.waitFor();
    assert.match(await summary.innerText(), /Confirmada/);
    assert.match(await summary.innerText(), /Descartada/);

    // Guardar sin tocarlas no las anota como cambio (el orden de claves del JSON no cuenta).
    await go(`/deviations/${saved.id}/edit`);
    await qa.locator("details.investigation-tools[open]").waitFor();
    const historyBefore = await prisma.changeHistory.count({ where: { qmsRecordId, fieldPath: "investigationTools" } });
    await qa.locator('textarea[name="howHappened"]').fill("Durante la revisión del lote");
    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.waitForURL(/\/deviations\/[0-9a-f-]{36}(\?|$)/, { timeout: 30000 });
    assert.equal((await prisma.deviation.findUniqueOrThrow({ where: { id: saved.id } })).howHappened, "Durante la revisión del lote");
    assert.equal(await prisma.changeHistory.count({ where: { qmsRecordId, fieldPath: "investigationTools" } }), historyBefore);

    assert.deepEqual(errors, []);
    console.log("D-123 OK: 5 porqués, Ishikawa y brainstorming; solo lo confirmado pasa a causa raíz con su categoría; guardado, ficha y sin cambios espurios.");
  } finally {
    await browser.close();
    if (qmsRecordId) {
      await prisma.changeHistory.deleteMany({ where: { qmsRecordId } });
      await prisma.deviation.deleteMany({ where: { qmsRecordId } });
      await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId } });
      await prisma.qmsRecord.deleteMany({ where: { id: qmsRecordId } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
