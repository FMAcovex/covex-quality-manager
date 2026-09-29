import { expect, test } from "@playwright/test";

const stamp = Date.now();
const deviationCode = `D/A21/E2E/${stamp}`;
const capaCode = `AC/A21/E2E/${stamp}`;

test("alta real de Desviación y CAPA mediante useActionState", async ({ page }) => {
  await page.goto("/deviations/new");
  await page.locator('[name="businessCode"]').fill(deviationCode);
  await page.locator('[name="departmentId"]').selectOption({ index: 1 });
  await page.locator('[name="issueDate"]').fill("2098-04-01");
  await page.locator('[name="eventDateTime"]').fill("2098-04-01T10:15");
  await page.locator('[name="createdByText"]').fill("Diagnóstico A2.1 E2E");
  await page.locator('[name="whatHappened"]').fill("Evento ficticio enviado por el formulario React real.");
  await page.getByRole("button", { name: /Añadir acción inmediata/ }).click();
  await page.getByLabel("Acción ejecutada").fill("Contención ficticia");
  await page.getByLabel("Ejecutada por").fill("QA");
  await page.getByLabel("Fecha", { exact: true }).fill("2098-04-01");
  await page.getByRole("button", { name: /Guardar desviación/ }).click();
  await expect(page).toHaveURL(/\/deviations\/[0-9a-f-]+$/);
  console.log("A2.1 E2E DEVIATION URL", page.url());

  await page.goto("/capa/new");
  await page.locator('[name="businessCode"]').fill(capaCode);
  await page.locator('[name="departmentId"]').selectOption({ index: 1 });
  await page.locator('[name="openedAt"]').fill("2098-04-02");
  await page.locator('[name="createdByText"]').fill("Diagnóstico A2.1 E2E");
  await page.locator('[name="originType"]').selectOption({ label: "Desviación" });
  await page.locator('[name="originCode"]').fill(deviationCode);
  await page.locator('[name="defectDescription"]').fill("Defecto ficticio enviado por el formulario React real.");
  await page.locator('[name="rootCause"]').fill("Causa ficticia sustentada.");
  await page.getByRole("button", { name: /Añadir acción propuesta/ }).click();
  await page.getByLabel("Descripción de la acción").fill("Acción planificada ficticia");
  await page.getByLabel("Responsable").fill("QA");
  await page.getByLabel("Fecha prevista").fill("2098-04-20");
  await page.getByRole("button", { name: /Guardar CAPA/ }).click();
  await expect(page).toHaveURL(/\/capa\/[0-9a-f-]+$/);
  console.log("A2.1 E2E CAPA URL", page.url());
});
