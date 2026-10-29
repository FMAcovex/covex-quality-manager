import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { isolatedTestEnvironment, authConfiguration } from "../src/lib/auth/config";
import { chromium, authenticatedPage } from "./auth-fixtures/browser";

// D-122: un modelo de Control de cambios creado en Configuración prerrellena el alta, no guarda
// nada por sí solo y queda anotado en el historial del cambio.
async function main() {
  assert(isolatedTestEnvironment(), "Exclusivamente base sintética aislada");
  const base = authConfiguration().origin, marker = "MODELO-" + randomUUID().slice(0, 8);
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  let changeQmsId: string | null = null;
  try {
    const qa = await authenticatedPage(browser);
    qa.on("pageerror", e => errors.push(e.message));
    const go = async (path: string) => { await qa.goto(base + path); await qa.waitForLoadState("networkidle"); };

    // Alta del modelo; el servidor rechaza un nombre vacío.
    await go("/settings/change-models");
    const create = qa.locator("form.change-model-form").last();
    await create.locator('[name="name"]').fill(marker);
    await create.locator('[name="purpose"]').fill("Caso tipo de prueba");
    await create.locator('input[name="scope"][value="SUPPLIER"]').check();
    await create.locator('[name="changeDescription"]').fill(`${marker} descripción guía`);
    await create.locator('[name="tasks"]').fill("Cualificar al proveedor\nActualizar la especificación");
    await create.getByRole("button", { name: "Crear modelo" }).click();
    await qa.getByRole("status").filter({ hasText: "Modelo guardado." }).waitFor();
    const model = await prisma.changeControlModel.findFirstOrThrow({ where: { name: marker } });
    assert.deepEqual(model.tasks, ["Cualificar al proveedor", "Actualizar la especificación"]);
    assert.deepEqual(model.scope, ["SUPPLIER"]);
    assert.equal(model.version, 1);
    assert.equal(await prisma.configurationChange.count({ where: { entityType: "ChangeControlModel", entityKey: model.id, action: "CREATE" } }), 1);

    // Aplicar el modelo prerrellena la solicitud y el plan, sin guardar nada.
    const before = await prisma.changeControl.count();
    await go("/changes/new");
    await qa.locator('form.change-model-picker select[name="model"]').selectOption(model.id);
    await qa.getByRole("button", { name: "Aplicar modelo" }).click();
    await qa.waitForURL(new RegExp(`model=${model.id}`));
    await qa.waitForLoadState("networkidle");
    await qa.getByText(`Prerrellenado con el modelo «${marker}».`).waitFor();
    assert.equal(await qa.locator('textarea[name="description"]').inputValue(), `${marker} descripción guía`);
    assert.equal(await qa.locator('input[name="scope"][value="SUPPLIER"]').isChecked(), true);
    const tasks = JSON.parse(await qa.locator('input[name="tasksJson"]').inputValue()) as Array<{ description: string; responsible: string; plannedDate: string }>;
    assert.deepEqual(tasks.map(t => [t.description, t.responsible, t.plannedDate]), [["Cualificar al proveedor", "", ""], ["Actualizar la especificación", "", ""]]);
    assert.equal(await qa.locator('[name="evaluation"]').inputValue(), "", "la evaluación no se prerrellena");
    assert.equal(await prisma.changeControl.count(), before, "aplicar el modelo no guarda nada");
    assert.equal(await qa.locator('input[name="fromModelVersion"]').inputValue(), "1", "se anota la versión con la que se prerrellenó");

    // Guardar el borrador anota el modelo en el historial de alta.
    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.waitForURL(/\/changes\/[0-9a-f-]{36}/, { timeout: 30000 });
    const change = await prisma.changeControl.findFirstOrThrow({ where: { description: `${marker} descripción guía` } });
    changeQmsId = change.qmsRecordId;
    const history = await prisma.changeHistory.findFirstOrThrow({ where: { qmsRecordId: change.qmsRecordId, fieldPath: "__created__" } });
    assert.match(history.reason ?? "", new RegExp(`desde el modelo «${marker}» \\(versión 1\\)`));

    // Desactivar sube la versión y lo saca del selector del alta.
    await go("/settings/change-models");
    const item = qa.locator("details.change-model-item", { hasText: marker });
    await item.locator("summary").click();
    await item.locator('select[name="isActive"]').selectOption("false");
    await item.getByRole("button", { name: "Guardar cambios" }).click();
    await item.getByRole("status").filter({ hasText: "Modelo guardado." }).waitFor();
    const inactive = await prisma.changeControlModel.findUniqueOrThrow({ where: { id: model.id } });
    assert.equal(inactive.isActive, false);
    assert.equal(inactive.version, 2);
    await go(`/changes/new?model=${model.id}`);
    assert.equal(await qa.getByText(`Prerrellenado con el modelo «${marker}».`).count(), 0, "un modelo inactivo no se aplica");
    assert.deepEqual(errors, []);
    console.log("D-122 OK: modelo creado en Configuración, alta prerrellenada sin guardar, historial con el modelo y desactivación.");
  } finally {
    await browser.close();
    if (changeQmsId) {
      await prisma.changeHistory.deleteMany({ where: { qmsRecordId: changeQmsId } });
      await prisma.changeControlTask.deleteMany({ where: { changeControl: { qmsRecordId: changeQmsId } } });
      await prisma.changeControl.deleteMany({ where: { qmsRecordId: changeQmsId } });
      await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: changeQmsId } });
      await prisma.qmsRecord.deleteMany({ where: { id: changeQmsId } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
