import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { isolatedTestEnvironment, authConfiguration } from "../src/lib/auth/config";
import { chromium, authenticatedPage } from "./auth-fixtures/browser";

// D-126: viñetas en los textos largos de Desviaciones y Controles de cambios. El botón «• Viñetas»
// pone o quita «• », Intro continúa la lista, se guarda como texto y la ficha lo muestra como lista.
async function main() {
  assert(isolatedTestEnvironment(), "Exclusivamente base sintética aislada");
  const base = authConfiguration().origin, marker = "VINETAS-" + randomUUID().slice(0, 8);
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  const created: string[] = [];
  try {
    const qa = await authenticatedPage(browser);
    qa.on("pageerror", e => errors.push(e.message));
    const go = async (path: string) => { await qa.goto(base + path); await qa.waitForLoadState("networkidle"); };
    const department = await prisma.department.findFirstOrThrow({ where: { isActive: true }, orderBy: { code: "asc" } });

    // Desviación: viñeta en la línea del cursor, Intro continúa la lista y en una viñeta vacía la termina.
    await go("/deviations/new");
    await qa.locator('select[name="departmentId"]').selectOption(department.id);
    const what = qa.getByLabel("¿Qué sucedió / qué debía haber sucedido? *");
    await what.fill(`${marker}\nAlarma sin aviso`);
    await what.press("End");
    const bullets = qa.getByRole("button", { name: "Viñetas en «¿Qué sucedió / qué debía haber sucedido?»" });
    await bullets.click();
    assert.equal(await what.inputValue(), `${marker}\n• Alarma sin aviso`);
    // Deshacer (Ctrl+Z) quita la viñeta puesta con el botón.
    await what.press("Control+z");
    assert.equal(await what.inputValue(), `${marker}\nAlarma sin aviso`, "se puede deshacer");
    await bullets.click();
    await what.press("End");
    await what.press("Enter");
    await what.pressSequentially("Registro incompleto");
    await what.press("Enter");
    await what.press("Enter");
    await what.pressSequentially("Fin");
    // Mayúsculas+Intro hace un salto de línea normal, también dentro de una lista.
    await what.press("Shift+Enter");
    await what.pressSequentially("Otra línea");
    const expected = `${marker}\n• Alarma sin aviso\n• Registro incompleto\nFin\nOtra línea`;
    assert.equal(await what.inputValue(), expected);
    // El campo sigue teniendo su etiqueta (el resumen de errores y los lectores de pantalla la usan).
    assert.equal(await qa.getByLabel("Investigación realizada / resultado y conclusiones *").count(), 1);

    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.waitForURL(/\/deviations\/[0-9a-f-]{36}(\?|$)/, { timeout: 30000 });
    // El navegador envía los saltos de línea como \r\n, igual que en el resto de campos de texto.
    const lf = (value: string | null) => value?.replace(/\r\n/g, "\n");
    const deviation = await prisma.deviation.findFirstOrThrow({ where: { whatHappened: { startsWith: marker } } });
    assert.equal(lf(deviation.whatHappened), expected);
    created.push(deviation.qmsRecordId);
    await go(`/deviations/${deviation.id}?tab=deviation`);
    const whatItem = qa.locator(".info-item", { hasText: "Qué sucedió / qué debía haber sucedido" });
    assert.deepEqual(await whatItem.locator(".text-bullets li").allTextContents(), ["Alarma sin aviso", "Registro incompleto"]);
    assert.match(await whatItem.locator("dd").innerText(), new RegExp(`${marker}[\\s\\S]*Fin\\nOtra línea`));

    // Control de cambios: con varias líneas seleccionadas el botón las pone todas; otra vez, las quita.
    await go("/changes/new");
    await qa.locator('textarea[name="description"]').fill(`${marker} cambio`);
    const evaluation = qa.locator('textarea[name="evaluation"]');
    await evaluation.fill("Riesgo bajo\n\nSin impacto en validación");
    await evaluation.press("Control+a");
    const evaluationBullets = qa.getByRole("button", { name: "Viñetas en «Evaluación del cambio»" });
    await evaluationBullets.click();
    assert.equal(await evaluation.inputValue(), "• Riesgo bajo\n\n• Sin impacto en validación");
    await evaluationBullets.click();
    assert.equal(await evaluation.inputValue(), "Riesgo bajo\n\nSin impacto en validación");
    await evaluationBullets.click();
    await qa.getByRole("button", { name: /Guardar borrador/ }).first().click();
    await qa.waitForURL(/\/changes\/[0-9a-f-]{36}/, { timeout: 30000 });
    const change = await prisma.changeControl.findFirstOrThrow({ where: { description: `${marker} cambio` } });
    created.push(change.qmsRecordId);
    assert.equal(lf(change.evaluation), "• Riesgo bajo\n\n• Sin impacto en validación");
    await go(`/changes/${change.id}?tab=dictamen`);
    assert.deepEqual(await qa.locator(".change-evaluation-card .text-bullets li").allTextContents(), ["Riesgo bajo", "Sin impacto en validación"]);

    // CAPA, OOS, Reclamaciones y Devoluciones: el mismo botón en sus textos largos.
    for (const path of ["/capa/new", "/oos/new", "/complaints/new", "/returns/new"]) {
      await go(path);
      const button = qa.getByRole("button", { name: /^Viñetas en «/ }).first();
      const textarea = button.locator("xpath=ancestor::div[contains(@class,'text-field-head')][1]/following-sibling::textarea[1]");
      await textarea.fill("Primera\nSegunda");
      await textarea.press("Control+a");
      await button.click();
      assert.equal(await textarea.inputValue(), "• Primera\n• Segunda", `viñetas en ${path}`);
      assert.ok(await qa.getByRole("button", { name: /^Viñetas en «/ }).count() >= 3, `textos largos con viñetas en ${path}`);
    }

    assert.deepEqual(errors, []);
    console.log("D-126 OK: viñetas con el botón, Intro y deshacer; se guardan como texto y la ficha las muestra como lista.");
  } finally {
    await browser.close();
    for (const qmsRecordId of created) {
      await prisma.changeHistory.deleteMany({ where: { qmsRecordId } });
      await prisma.deviation.deleteMany({ where: { qmsRecordId } });
      await prisma.changeControlTask.deleteMany({ where: { changeControl: { qmsRecordId } } });
      await prisma.changeControl.deleteMany({ where: { qmsRecordId } });
      await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId } });
      await prisma.qmsRecord.deleteMany({ where: { id: qmsRecordId } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
