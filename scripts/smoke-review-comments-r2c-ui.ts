import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "./auth-fixtures/browser";
import { type Locator, type Page } from "playwright";
import { prisma } from "@/lib/db";
import { serializeChangeControlVersion, snapshotJson } from "@/lib/qms/versioning";

// Own disposable fixtures only: never alter demo records or persisted user history.
const recordIds: string[] = [];
const prefix = `R2C-UI-${randomUUID()}`;
const base = process.env.R2C_UI_BASE_URL;

async function waitForServer(url: string) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("El servidor Next no está listo para el smoke UI R2C.");
}

async function createObservation(page: Page, anchor: string, message: string) {
  await page.locator(`#${anchor} .review-marker`).click();
  const drawer = page.locator(".review-drawer");
  const form = drawer.locator(".review-form").last();
  await form.locator("textarea").fill(message);
  await form.getByRole("button", { name: "Crear observación", exact: true }).click();
  await drawer.locator(".review-message").getByText(message, { exact: true }).waitFor();
  return drawer.locator(".review-thread-card").filter({ hasText: message });
}

async function goToField(page: Page, card: Locator, anchor: string, tab: string) {
  await card.getByRole("link", { name: "Ir al campo", exact: true }).click();
  await page.locator(`#${anchor}.review-target-highlight`).waitFor();
  let url = new URL(page.url());
  assert.equal(url.searchParams.get("tab"), tab);
  assert.equal(url.searchParams.get("review"), "1");
  assert.ok(url.searchParams.get("thread"));
  assert.equal(url.hash, `#${anchor}`);
  assert.equal(await page.locator(".review-drawer").count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement?.id), anchor);
  // A reload must hydrate the same historical conversation without errors.
  await page.reload();
  await page.locator(`#${anchor}.review-target-highlight`).waitFor();
  url = new URL(page.url());
  assert.equal(url.hash, `#${anchor}`);
  await page.waitForFunction((id) => {
    const rect = document.getElementById(id)?.getBoundingClientRect();
    return rect && rect.top < window.innerHeight && rect.bottom > 0;
  }, anchor);
  await page.waitForFunction(() => !document.querySelector(".review-target-highlight"));
}

async function main() {
  if (!base || process.env.APP_ENV !== "test") {
    throw new Error("Define APP_ENV=test y R2C_UI_BASE_URL para una base/servidor de pruebas aislados.");
  }
  await waitForServer(base);
  const browser = await chromium.launch({
    executablePath: process.env.R2C_UI_CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  // The reported failure requires different server/browser time zones.
  const page = await browser.newPage({ timezoneId: "Europe/Madrid" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const department = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });
    const deviationRecord = await prisma.qmsRecord.create({ data: { recordType: "DEVIATION", year: 2026, businessCode: `${prefix}-DEV` } });
    recordIds.push(deviationRecord.id);
    const deviation = await prisma.deviation.create({ data: { qmsRecordId: deviationRecord.id, provenance: "FINISHED_PRODUCT_SYSTEM" } });
    await page.goto(`${base}/deviations?q=${encodeURIComponent(deviationRecord.businessCode!)}&provenance=FINISHED_PRODUCT_SYSTEM`);
    assert.deepEqual(await page.locator("td[data-column-key=provenance]").allTextContents(), ["Producto terminado / Sistema"]);
    const option = page.locator('input[name=provenance][value=FINISHED_PRODUCT_SYSTEM]');
    assert.ok(await option.isChecked());
    assert.equal(await option.locator("..").locator("span").textContent(), "Producto terminado / Sistema");
    assert.equal((await prisma.deviation.findUniqueOrThrow({ where: { id: deviation.id } })).provenance, "FINISHED_PRODUCT_SYSTEM");
    console.log("Desviaciones: label de columna/filtro en español y valor interno del filtro/persistencia intacto OK.");
    const capaRecord = await prisma.qmsRecord.create({ data: { recordType: "CAPA", year: 2026, businessCode: `${prefix}-CAPA` } });
    recordIds.push(capaRecord.id);
    const capa = await prisma.capa.create({ data: { qmsRecordId: capaRecord.id, actionType: "CORRECTIVE", status: "OPEN", rootCause: "Causa revisada" } });
    const capaVersion = await prisma.qmsRecordVersion.create({ data: {
      qmsRecordId: capaRecord.id, sequenceNumber: 0, kind: "INITIAL", snapshot: { text: "Apertura" },
    } });
    const historical = await prisma.reviewThread.create({ data: {
      qmsRecordId: capaRecord.id, recordVersionId: capaVersion.id,
      targetKind: "FIELD", tabKey: "summary", sectionKey: "root-cause", fieldPath: "rootCause",
      fieldLabelSnapshot: "Causa raíz histórica", valueSnapshot: { text: "Valor observado histórico" },
      status: "RESOLVED", createdByText: "Smoke UI", acceptedByText: "Smoke UI", resolvedByText: "Smoke UI",
      acceptedAt: new Date("2026-10-07T09:22:00Z"), resolvedAt: new Date("2026-10-07T09:23:00Z"),
      messages: { create: { message: "Comentario CAPA persistido antes de abrir Revisión", createdByText: "Smoke UI", createdAt: new Date("2026-10-07T09:21:00Z") } },
    }, include: { messages: true } });
    const unavailable = await prisma.reviewThread.create({ data: {
      qmsRecordId: capaRecord.id, recordVersionId: capaVersion.id,
      targetKind: "ITEM", tabKey: "summary", sectionKey: "planned-actions", fieldPath: "description",
      targetEntityType: "CapaPlannedAction", targetEntityId: randomUUID(),
      fieldLabelSnapshot: "Acción histórica no disponible", valueSnapshot: { text: "Snapshot conservado" },
      createdByText: "Smoke UI", messages: { create: { message: "Comentario cuyo target histórico ya no existe", createdByText: "Smoke UI" } },
    }, include: { messages: true } });
    const capaPath = `${base}/capa/${capa.id}`;
    await page.goto(`${capaPath}?tab=review&review=1`);
    const historicalCard = page.locator(".review-thread-card").filter({ hasText: historical.messages[0].message });
    await historicalCard.getByText("Smoke UI · 7 oct 2026, 9:21 UTC", { exact: true }).waitFor();
    await historicalCard.getByText(/Aceptada:/).waitFor();
    await historicalCard.getByText(/Resuelta:/).waitFor();
    const unavailableCard = page.locator(".review-thread-card").filter({ hasText: unavailable.messages[0].message });
    await unavailableCard.waitFor();
    assert.equal(await unavailableCard.getByRole("link", { name: "Ir al campo" }).count(), 0);
    await unavailableCard.getByRole("button", { name: "Ver hilo" }).click();
    await page.locator(".review-drawer").getByText("Comentario cuyo target histórico ya no existe", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await goToField(page, historicalCard, "review-capa-root-cause", "summary");
    for (const original of [historical, unavailable]) {
      assert.deepEqual(await prisma.reviewThread.findUniqueOrThrow({ where: { id: original.id }, include: { messages: true } }), original);
    }
    assert.deepEqual(errors, [], "CAPA no debe producir errores de hidratación");
    console.log("CAPA: comentario histórico, snapshot/versión intactos, target disponible/ausente y recarga sin errores de hidratación OK.");

    const changeRecord = await prisma.qmsRecord.create({ data: { recordType: "CHANGE_CONTROL", year: 2026, businessCode: `${prefix}-CC` } });
    recordIds.push(changeRecord.id);
    const change = await prisma.changeControl.create({ data: {
      qmsRecordId: changeRecord.id, departmentId: department.id, finalStatus: "OPEN", dictamenResult: "APPROVED",
      requestDecision: "ACCEPTED", description: "Prueba focalizada de seguimiento y Review",
    } });
    const task = await prisma.changeControlTask.create({ data: {
      changeControlId: change.id, departmentId: department.id, description: "Acción de prueba", responsible: "Smoke UI", origin: "DICTAMEN",
    } });
    const opening = await prisma.changeControlFollowup.create({ data: {
      changeControlId: change.id, sequenceNumber: 0, followupDate: new Date("2026-10-07"), responsible: "Smoke UI",
      executionStatus: "NOT_EXECUTED", effectivenessStatus: "PENDING",
      taskStates: { create: { taskId: task.id, status: "PENDING" } },
    } });
    const initialRecord = await prisma.changeControl.findUniqueOrThrow({ where: { id: change.id }, include: {
      qmsRecord: true, tasks: true, followups: { include: { taskStates: true } },
      formVersion: true, annexIIITemplateVersion: true, annexIVTemplateVersion: true, annexVTemplateVersion: true,
    } });
    await prisma.qmsRecordVersion.create({ data: {
      qmsRecordId: changeRecord.id, sequenceNumber: 0, kind: "INITIAL", snapshot: snapshotJson(serializeChangeControlVersion(initialRecord)),
    } });
    const changePath = `${base}/changes/${change.id}`;
    await page.goto(`${changePath}?tab=followups&review=1`);
    const openingAnchor = `review-change-control-followup-${opening.id}`;
    const openingCard = await createObservation(page, openingAnchor, "Comentario histórico en Seguimiento 00");
    await goToField(page, openingCard, openingAnchor, "followups");
    const originalOpeningThread = await prisma.reviewThread.findFirstOrThrow({ where: { qmsRecordId: changeRecord.id, targetEntityId: opening.id }, include: { messages: true } });

    for (const sequence of [1, 2]) {
      await page.goto(`${changePath}?tab=followups&review=1`);
      const form = page.locator("#new-followup form");
      await form.locator("[name=followupDate]").fill("2026-10-07");
      await form.locator("[name=responsible]").fill("Smoke UI");
      await form.locator("[name=nextFollowupDate]").fill("2026-11-07");
      await form.locator("[name=remainOpenReason]").fill("Pendiente de finalizar la prueba");
      const response = page.waitForResponse((result) => result.request().method() === "POST");
      await form.getByRole("button", { name: /Guardar seguimiento/ }).click();
      await response;
      await page.goto(`${changePath}?tab=followups&review=1`);
      const followup = await prisma.changeControlFollowup.findFirstOrThrow({ where: { changeControlId: change.id, sequenceNumber: sequence } });
      const anchor = `review-change-control-followup-${followup.id}`;
      const message = `Comentario en Seguimiento ${String(sequence).padStart(2, "0")}`;
      const card = await createObservation(page, anchor, message);
      const thread = await prisma.reviewThread.findFirstOrThrow({ where: { qmsRecordId: changeRecord.id, targetEntityId: followup.id }, include: { recordVersion: true } });
      assert.equal(thread.targetEntityId, followup.id);
      assert.equal(thread.tabKey, "followups");
      assert.equal(thread.recordVersion?.sequenceNumber, sequence);
      await goToField(page, card, anchor, "followups");
      // Also exercise the link from the thread list, including historical 00.
      for (const [threadId, fieldAnchor] of [[thread.id, anchor], [originalOpeningThread.id, openingAnchor]]) {
        await page.goto(`${changePath}?tab=review&review=1`);
        const text = threadId === originalOpeningThread.id ? "Comentario histórico en Seguimiento 00" : message;
        const listCard = page.locator(".review-thread-card").filter({ hasText: text });
        await listCard.waitFor();
        await goToField(page, listCard, fieldAnchor, "followups");
      }
      assert.deepEqual(await prisma.reviewThread.findUniqueOrThrow({ where: { id: originalOpeningThread.id }, include: { messages: true } }), originalOpeningThread);
    }
    assert.deepEqual(errors, [], "CC no debe producir errores de hidratación ni navegación");
    console.log("CC: 00→crear 01→comentario→Ir al campo/recarga; 02 posterior y enlaces históricos de 00; UUID/versión/snapshot preservados OK.");
  } finally {
    await browser.close();
    const scope = { qmsRecordId: { in: recordIds } };
    await prisma.reviewMessage.deleteMany({ where: { reviewThread: scope } });
    await prisma.reviewThread.deleteMany({ where: scope });
    await prisma.changeHistory.deleteMany({ where: scope });
    await prisma.qmsRecordVersion.deleteMany({ where: scope });
    await prisma.changeControlTaskState.deleteMany({ where: { task: { changeControl: scope } } });
    await prisma.changeControl.deleteMany({ where: scope });
    await prisma.capa.deleteMany({ where: scope });
    await prisma.deviation.deleteMany({ where: scope });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: recordIds } } });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
