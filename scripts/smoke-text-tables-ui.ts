import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { isolatedTestEnvironment, authConfiguration } from "../src/lib/auth/config";
import { chromium, authenticatedPage } from "./auth-fixtures/browser";

// D-127: tablas en los textos largos de Desviaciones. Se añaden bajo el campo, se pegan desde Excel,
// se guardan con el botón Guardar (validadas en el servidor) y la ficha las muestra numeradas.
async function main() {
  assert(isolatedTestEnvironment(), "Exclusivamente base sintética aislada");
  const base = authConfiguration().origin, marker = "TABLAS-" + randomUUID().slice(0, 8);
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
    await qa.locator('textarea[name="whatHappened"]').fill(`${marker} excursión de temperatura`);

    // Tabla en «Investigación»: pegar celdas de Excel en la primera celda reparte filas y columnas.
    await qa.getByRole("button", { name: "Añadir una tabla en «Investigación realizada / resultado y conclusiones»" }).click();
    const table = qa.locator("fieldset.text-table-editor", { hasText: "1.ª tabla de «Investigación realizada / resultado y conclusiones»" });
    const firstCell = table.getByLabel(/^Cabecera, columna 1 · /);
    await firstCell.evaluate((input) => {
      const data = new DataTransfer();
      data.setData("text/plain", "Lote\tTemp. máx.\tEstado\r\nL24-0815\t9,4 °C\tRetenido\r\nL24-0902\t9,1 °C\tLiberable\r\n");
      input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    assert.equal(await table.getByLabel(/^Cabecera, columna 3 · /).inputValue(), "Estado", "pegar añade las columnas que faltan");
    assert.equal(await table.getByLabel(/^Fila 2, columna 1 · /).inputValue(), "L24-0902");

    // Sin título no se guarda: el error sale en el campo y no se pierde la tabla.
    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.getByText("1.ª tabla: falta el título.").first().waitFor();
    assert.equal(await qa.locator("fieldset.text-table-editor").getByLabel(/^Fila 1, columna 2 · /).inputValue(), "9,4 °C", "la tabla se conserva tras el error");
    await qa.locator("fieldset.text-table-editor").getByLabel("Título *").fill("Lotes en la cámara C-03");

    // Una segunda tabla en «Causa raíz», que se quita sin dejar rastro.
    await qa.getByRole("button", { name: "Añadir una tabla en «Causa raíz»" }).click();
    await qa.getByRole("button", { name: "Quitar tabla" }).nth(1).click();
    assert.equal(await qa.locator("fieldset.text-table-editor").count(), 1);

    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.waitForURL(/\/deviations\/[0-9a-f-]{36}(\?|$)/, { timeout: 30000 });
    const deviation = await prisma.deviation.findFirstOrThrow({ where: { whatHappened: `${marker} excursión de temperatura` } });
    qmsRecordId = deviation.qmsRecordId;
    assert.deepEqual(deviation.textTables, {
      investigation: [{ title: "Lotes en la cámara C-03", columns: ["Lote", "Temp. máx.", "Estado"], rows: [["L24-0815", "9,4 °C", "Retenido"], ["L24-0902", "9,1 °C", "Liberable"]] }],
    });

    // La ficha la muestra numerada en su apartado.
    await go(`/deviations/${deviation.id}?tab=deviation`);
    const view = qa.locator(".text-table-view", { hasText: "Tabla 1. Lotes en la cámara C-03" });
    await view.waitFor();
    assert.deepEqual(await view.locator("th").allTextContents(), ["Lote", "Temp. máx.", "Estado"]);

    // Guardar sin tocarlas no las anota como cambio (el orden de claves de JSONB no cuenta).
    await go(`/deviations/${deviation.id}/edit`);
    assert.equal(await qa.locator("fieldset.text-table-editor").getByLabel("Título *").inputValue(), "Lotes en la cámara C-03");
    await qa.locator('textarea[name="howHappened"]').fill("Revisión del registro");
    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.waitForURL(/\/deviations\/[0-9a-f-]{36}(\?|$)/, { timeout: 30000 });
    assert.equal(await prisma.changeHistory.count({ where: { qmsRecordId, fieldPath: "textTables" } }), 0);

    assert.deepEqual(errors, []);
    console.log("D-127 OK: tablas bajo el texto, pegado desde Excel, error de título sin perder la tabla, guardado, ficha y sin cambios espurios.");
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
