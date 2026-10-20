import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { isolatedTestEnvironment, authConfiguration } from "../src/lib/auth/config";
import { chromium, authenticatedPage } from "./auth-fixtures/browser";
import { fixtureUsers } from "./auth-fixtures/constants";

// D-111 (V4): «Mis tareas» como primer bloque del inicio, sin pulsar nada.
async function main() {
  assert(isolatedTestEnvironment(), "Exclusivamente base sintética aislada");
  const base = authConfiguration().origin, marker = "UXV4-" + randomUUID().slice(0, 8);
  const department = await prisma.department.findFirstOrThrow({ orderBy: { code: "asc" } });
  const yesterday = new Date(); yesterday.setUTCHours(0, 0, 0, 0); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const capa = await prisma.capa.create({ data: { department: { connect: { id: department.id } }, qmsRecord: { create: { recordType: "CAPA", businessCode: `${marker}-CAPA`, year: yesterday.getUTCFullYear() } }, createdByText: "Autor sintético UX", status: "OPEN", actionType: "CORRECTIVE", defectDescription: marker } });
  await prisma.capaPlannedAction.create({ data: { capaId: capa.id, description: `${marker} acción vencida`, responsibleUserId: fixtureUsers.qa.id, plannedExecutionDate: yesterday } });
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  try {
    const qa = await authenticatedPage(browser);
    qa.on("pageerror", e => errors.push(e.message));
    await qa.goto(base + "/"); await qa.locator("main h1").first().waitFor();
    const block = qa.locator("#dashboard-my-tasks");
    assert(await block.isVisible(), "«Mis tareas» visible sin pulsar nada");
    assert.equal(await qa.locator("main section.dashboard-section").first().getAttribute("id"), "dashboard-my-tasks", "Es el primer bloque del panel");
    const row = block.locator("tr", { hasText: `${marker}-CAPA` });
    assert.equal(await row.count(), 1, "La tarea asignada aparece");
    assert.match(await row.locator(".badge").textContent() ?? "", /Vencida/);
    assert.equal(await qa.locator('a[href*="#dashboard-my-tasks"]').count() >= 1, true, "La tarjeta «asignadas a mí» lleva al bloque");
    assert.match(await block.innerText(), /figuras como usuario responsable/, "Nota sobre qué tareas aparecen");
    // Con filtros que ocultan sus tareas, el aviso lo dice (no afirma que no tenga ninguna).
    await qa.goto(base + "/?module=PNT"); await qa.locator("main h1").first().waitFor();
    assert.match(await qa.locator("#dashboard-my-tasks").innerText(), /No tienes tareas asignadas con estos filtros\./);

    const manager = await authenticatedPage(browser, "manager");
    manager.on("pageerror", e => errors.push(e.message));
    await manager.goto(base + "/"); await manager.locator("main h1").first().waitFor();
    assert.match(await manager.locator("#dashboard-my-tasks").innerText(), /No tienes tareas asignadas\./);
    assert.deepEqual(errors, []);
    console.log("UX V4 OK: «Mis tareas» primero, con vencidas y aviso sin tareas.");
  } finally {
    await browser.close();
  }
}
main().finally(() => prisma.$disconnect()).catch(e => { console.error(e); process.exitCode = 1; });
