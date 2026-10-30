import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { isolatedTestEnvironment, authConfiguration } from "../src/lib/auth/config";
import { chromium, authenticatedPage } from "./auth-fixtures/browser";

// D-127: tablas en los textos largos (Desviaciones, CAPA, Cambios, OOS, Reclamaciones y Devoluciones). Se añaden bajo el campo, se pegan desde Excel,
// se guardan con el botón Guardar (validadas en el servidor) y la ficha las muestra numeradas.
async function main() {
  assert(isolatedTestEnvironment(), "Exclusivamente base sintética aislada");
  const base = authConfiguration().origin, marker = "TABLAS-" + randomUUID().slice(0, 8);
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  let qmsRecordId: string | null = null;
  const others: string[] = [];
  try {
    const qa = await authenticatedPage(browser);
    qa.on("pageerror", e => errors.push(e.message));
    const go = async (path: string) => { await qa.goto(base + path); await qa.waitForLoadState("networkidle"); };
    const department = await prisma.department.findFirstOrThrow({ where: { isActive: true }, orderBy: { code: "asc" } });

    await go("/deviations/new");
    await qa.locator('select[name="departmentId"]').selectOption(department.id);
    await qa.locator('textarea[name="whatHappened"]').fill(`${marker} excursión de temperatura`);

    // Tabla en «Investigación»: pegar celdas de Excel en la primera celda reparte filas y columnas.
    await qa.getByRole("button", { name: "Añadir tabla en «Investigación realizada / resultado y conclusiones»" }).click();
    const table = qa.locator("fieldset.text-table-editor", { hasText: "1.ª tabla de «Investigación realizada / resultado y conclusiones»" });
    const firstCell = table.getByLabel(/^Cabecera, columna 1 · /);
    await firstCell.evaluate((input) => {
      const data = new DataTransfer();
      data.setData("text/plain", "Lote\tTemp. máx.\tEstado\r\nL24-0815\t9,4 °C\tRetenido\r\nL24-0902\t9,1 °C\tLiberable\r\n");
      input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    assert.equal(await table.getByLabel(/^Cabecera, columna 3 · /).inputValue(), "Estado", "pegar añade las columnas que faltan");
    assert.equal(await table.getByLabel(/^Fila 2, columna 1 · /).inputValue(), "L24-0902");
    // Intro en una celda pasa a la de debajo; no envía el formulario (el guardado es explícito).
    await table.getByLabel(/^Fila 1, columna 1 · /).press("Enter");
    assert.equal(await table.getByLabel(/^Fila 2, columna 1 · /).evaluate((input) => input === document.activeElement), true, "Intro baja a la celda siguiente");
    await qa.waitForTimeout(500);
    assert.match(qa.url(), /\/deviations\/new/, "Intro no guarda");
    assert.equal(await prisma.deviation.count({ where: { whatHappened: `${marker} excursión de temperatura` } }), 0);

    // Sin título no se guarda: el error sale en el campo y no se pierde la tabla.
    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.getByText("1.ª tabla: falta el título.").first().waitFor();
    assert.equal(await qa.locator("fieldset.text-table-editor").getByLabel(/^Fila 1, columna 2 · /).inputValue(), "9,4 °C", "la tabla se conserva tras el error");
    await qa.locator("fieldset.text-table-editor").getByLabel("Título *").fill("Lotes en la cámara C-03");

    // Una segunda tabla en «Causa raíz», que se quita sin dejar rastro.
    await qa.getByRole("button", { name: "Añadir tabla en «Causa raíz»" }).click();
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

    // Cambiar una celda sí queda en el historial de modificaciones.
    await go(`/deviations/${deviation.id}/edit`);
    await qa.locator("fieldset.text-table-editor").getByLabel(/^Fila 2, columna 3 · /).fill("Retenido");
    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.waitForURL(/\/deviations\/[0-9a-f-]{36}(\?|$)/, { timeout: 30000 });
    assert.equal(await prisma.changeHistory.count({ where: { qmsRecordId, fieldPath: "textTables" } }), 1);

    // Pegar una tabla de Excel en la primera celda de una tabla nueva bajo el campo indicado.
    const addTable = async (fieldLabel: string, title: string) => {
      await qa.getByRole("button", { name: `Añadir tabla en «${fieldLabel}»` }).click();
      const editor = qa.locator("fieldset.text-table-editor", { hasText: `1.ª tabla de «${fieldLabel}»` });
      await editor.getByLabel("Título *").fill(title);
      await editor.getByLabel(/^Cabecera, columna 1 · /).evaluate((input) => {
        const data = new DataTransfer();
        data.setData("text/plain", "Elemento\tResultado\r\nUno\tConforme\r\n");
        input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
      });
    };
    const expected = (title: string) => [{ title, columns: ["Elemento", "Resultado"], rows: [["Uno", "Conforme"]] }];

    // CAPA: tabla en «Causa raíz», guardada con el borrador y en la ficha.
    await go("/capa/new");
    await qa.locator('textarea[name="defectDescription"]').fill(`${marker} defecto CAPA`);
    await addTable("Causa raíz", "Causas evaluadas");
    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.waitForURL(/\/capa\/[0-9a-f-]{36}(\?|$)/, { timeout: 30000 });
    const capa = await prisma.capa.findFirstOrThrow({ where: { defectDescription: `${marker} defecto CAPA` } });
    others.push(capa.qmsRecordId);
    assert.deepEqual(capa.textTables, { rootCause: expected("Causas evaluadas") });
    await go(`/capa/${capa.id}`);
    await qa.locator(".text-table-view", { hasText: "Tabla 1. Causas evaluadas" }).waitFor();
    // Volver a guardar sin tocarla no la anota como cambio; cambiar una celda, sí.
    const resave = async (path: string, url: RegExp, edit?: () => Promise<void>) => {
      await go(path);
      if (edit) await edit();
      await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
      await qa.waitForURL(url, { timeout: 30000 });
    };
    const tableHistory = (qmsRecordId: string) => prisma.changeHistory.count({ where: { qmsRecordId, fieldPath: "textTables" } });
    await resave(`/capa/${capa.id}/edit`, /\/capa\/[0-9a-f-]{36}(\?|$)/);
    assert.equal(await tableHistory(capa.qmsRecordId), 0, "CAPA: guardar sin tocar la tabla no anota cambios");
    await resave(`/capa/${capa.id}/edit`, /\/capa\/[0-9a-f-]{36}(\?|$)/, () => qa.locator("fieldset.text-table-editor").getByLabel(/^Fila 1, columna 2 · /).fill("No conforme"));
    assert.equal(await tableHistory(capa.qmsRecordId), 1, "CAPA: el cambio de la tabla queda en el historial");

    // Control de cambios: tabla en «Evaluación del cambio» (Anexo IV), en la ficha del dictamen.
    await go("/changes/new");
    await qa.locator('textarea[name="description"]').fill(`${marker} cambio`);
    await addTable("Evaluación del cambio", "Riesgos del cambio");
    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.waitForURL(/\/changes\/[0-9a-f-]{36}/, { timeout: 30000 });
    const change = await prisma.changeControl.findFirstOrThrow({ where: { description: `${marker} cambio` } });
    others.push(change.qmsRecordId);
    assert.deepEqual(change.textTables, { evaluation: expected("Riesgos del cambio") });
    await go(`/changes/${change.id}?tab=dictamen`);
    await qa.locator(".change-evaluation-card .text-table-view", { hasText: "Tabla 1. Riesgos del cambio" }).waitFor();
    await resave(`/changes/${change.id}/edit`, /\/changes\/[0-9a-f-]{36}(\?|$)/);
    assert.equal(await tableHistory(change.qmsRecordId), 0, "Cambio: guardar sin tocar la tabla no anota cambios");
    await resave(`/changes/${change.id}/edit`, /\/changes\/[0-9a-f-]{36}(\?|$)/, () => qa.locator("fieldset.text-table-editor").getByLabel(/^Fila 1, columna 2 · /).fill("No conforme"));
    assert.equal(await tableHistory(change.qmsRecordId), 1, "Cambio: el cambio de la tabla queda en el historial");

    // OOS: tabla en «Detección», en la ficha (Resumen). El historial del OOS es una sola foto por edición.
    await go("/oos/new");
    await qa.locator('[name="materialName"]').fill(`${marker} OOS`);
    await addTable("Detección del fuera de especificaciones", "Resultados del ensayo");
    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.waitForURL(/\/oos\/[0-9a-f-]{36}(\?|$)/, { timeout: 30000 });
    const oos = await prisma.oosRecord.findFirstOrThrow({ where: { materialName: `${marker} OOS` } });
    others.push(oos.qmsRecordId);
    assert.deepEqual(oos.textTables, { detectionDescription: expected("Resultados del ensayo") });
    await go(`/oos/${oos.id}`);
    await qa.locator(".text-table-view", { hasText: "Tabla 1. Resultados del ensayo" }).waitFor();
    // Al editar, la tabla vuelve al editor y se conserva al guardar otro cambio.
    await resave(`/oos/${oos.id}/edit`, /\/oos\/[0-9a-f-]{36}(\?|$)/, () => qa.locator('[name="lotNumber"]').fill("L-TABLAS"));
    assert.deepEqual((await prisma.oosRecord.findUniqueOrThrow({ where: { id: oos.id } })).textTables, { detectionDescription: expected("Resultados del ensayo") });

    // Reclamaciones: tabla en «Descripción», en la ficha (Parte I).
    await go("/complaints/new");
    await qa.locator('input[name="complaintType"][value="CUSTOMER"]').check();
    await qa.locator('[name="partyName"]').fill(`${marker} cliente`);
    await addTable("Descripción de la reclamación", "Unidades afectadas");
    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.waitForURL(/\/complaints\/[0-9a-f-]{36}(\?|$)/, { timeout: 30000 });
    const complaint = await prisma.complaint.findFirstOrThrow({ where: { partyName: `${marker} cliente` } });
    others.push(complaint.qmsRecordId);
    assert.deepEqual(complaint.textTables, { description: expected("Unidades afectadas") });
    await go(`/complaints/${complaint.id}?tab=part-i`);
    await qa.locator(".text-table-view", { hasText: "Tabla 1. Unidades afectadas" }).waitFor();
    await resave(`/complaints/${complaint.id}/edit`, /\/complaints\/[0-9a-f-]{36}(\?|$)/, () => qa.locator("fieldset.text-table-editor").getByLabel(/^Fila 1, columna 2 · /).fill("No conforme"));
    assert.deepEqual((await prisma.complaint.findUniqueOrThrow({ where: { id: complaint.id } })).textTables, { description: [{ title: "Unidades afectadas", columns: ["Elemento", "Resultado"], rows: [["Uno", "No conforme"]] }] });

    // Devoluciones: tabla en «Observaciones o incidencias», en la ficha (Resumen).
    await go("/returns/new");
    await qa.locator('[name="customerEntity"]').fill(`${marker} entidad`);
    await addTable("Observaciones o incidencias", "Unidades recibidas");
    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.waitForURL(/\/returns\/[0-9a-f-]{36}(\?|$)/, { timeout: 30000 });
    const returned = await prisma.returnRecord.findFirstOrThrow({ where: { customerEntity: `${marker} entidad` } });
    others.push(returned.qmsRecordId);
    assert.deepEqual(returned.textTables, { reasonObservations: expected("Unidades recibidas") });
    await go(`/returns/${returned.id}`);
    await qa.locator(".text-table-view", { hasText: "Tabla 1. Unidades recibidas" }).waitFor();

    assert.deepEqual(errors, []);
    console.log("D-127 OK (Desviaciones, CAPA, Controles de cambios, OOS, Reclamaciones y Devoluciones): tablas bajo el texto, pegado desde Excel, Intro sin guardar, error de título sin perder la tabla, guardado, ficha, sin cambios espurios y cambio real en el historial.");
  } finally {
    await browser.close();
    if (qmsRecordId) {
      await prisma.changeHistory.deleteMany({ where: { qmsRecordId } });
      await prisma.deviation.deleteMany({ where: { qmsRecordId } });
      await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId } });
      await prisma.qmsRecord.deleteMany({ where: { id: qmsRecordId } });
    }
    for (const id of others) {
      await prisma.changeHistory.deleteMany({ where: { qmsRecordId: id } });
      await prisma.capa.deleteMany({ where: { qmsRecordId: id } });
      await prisma.oosRecord.deleteMany({ where: { qmsRecordId: id } });
      await prisma.complaintCapaPlan.deleteMany({ where: { complaint: { qmsRecordId: id } } });
      await prisma.complaintDerivedAction.deleteMany({ where: { complaint: { qmsRecordId: id } } });
      await prisma.complaint.deleteMany({ where: { qmsRecordId: id } });
      await prisma.returnProduct.deleteMany({ where: { returnRecord: { qmsRecordId: id } } });
      await prisma.returnRecord.deleteMany({ where: { qmsRecordId: id } });
      await prisma.changeControlTask.deleteMany({ where: { changeControl: { qmsRecordId: id } } });
      await prisma.changeControl.deleteMany({ where: { qmsRecordId: id } });
      await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: id } });
      await prisma.qmsRecord.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
