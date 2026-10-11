import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, type Dialog } from "playwright";
import { prisma } from "../src/lib/db";

const base = process.env.C3_UI_BASE_URL;
const marker = "UXC3-" + randomUUID();
const ids: string[] = [];

const scenarios = [
  { root: "/deviations", type: "DEVIATION" as const, field: "whatHappened",
    create: (qmsRecordId: string) => prisma.deviation.create({ data: { qmsRecordId, status: "DRAFT", provenance: "OTHER" } }) },
  { root: "/capa", type: "CAPA" as const, field: "defectDescription",
    create: (qmsRecordId: string) => prisma.capa.create({ data: { qmsRecordId, status: "DRAFT", actionType: "CORRECTIVE" } }) },
  { root: "/changes", type: "CHANGE_CONTROL" as const, field: "description",
    create: (qmsRecordId: string) => prisma.changeControl.create({ data: { qmsRecordId, finalStatus: "DRAFT" } }) },
  { root: "/complaints", type: "COMPLAINT" as const, field: "description",
    create: (qmsRecordId: string) => prisma.complaint.create({ data: { qmsRecordId, status: "DRAFT", complaintType: "CUSTOMER" } }) },
  { root: "/returns", type: "RETURN" as const, field: "reasonObservations",
    create: (qmsRecordId: string) => prisma.returnRecord.create({ data: { qmsRecordId, status: "DRAFT", returnType: "COMMERCIAL" } }) },
];

async function main() {
  if (process.env.APP_ENV !== "test" || !base) throw new Error("APP_ENV=test y C3_UI_BASE_URL son obligatorios.");
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && /hydrat|server rendered/i.test(m.text())) errors.push(m.text()); });
  try {
    for (const scenario of scenarios) {
      const record = await prisma.qmsRecord.create({ data: {
        recordType: scenario.type, businessCode: marker + "-" + scenario.type, year: 2026,
      } });
      ids.push(record.id);
      const item = await scenario.create(record.id);
      const detail = `${scenario.root}/${item.id}`;
      const returnTo = `${scenario.root}?q=${encodeURIComponent(marker)}&year=2026&status=DRAFT`;
      const edit = `${detail}/edit?returnTo=${encodeURIComponent(returnTo)}&tab=summary`;

      await page.goto(base + edit);
      await page.waitForLoadState("networkidle");
      const field = page.locator(`form input[name="${scenario.field}"], form textarea[name="${scenario.field}"]`).first();
      assert(await field.count(), scenario.root + ": campo editable ausente");
      await field.fill("Prueba C3 de datos no guardados");

      const cancel = page.getByRole("link", { name: "Cancelar", exact: true });
      const rejected = page.waitForEvent("dialog");
      const click = cancel.click();
      const firstDialog = await rejected;
      assert.match(firstDialog.message(), /cambios sin guardar/i);
      await firstDialog.dismiss();
      await click;
      assert(new URL(page.url()).pathname.endsWith("/edit"), scenario.root + ": Cancelar descartó datos pese al rechazo");
      assert.equal(await field.inputValue(), "Prueba C3 de datos no guardados");

      const accepted = page.waitForEvent("dialog");
      const confirmClick = cancel.click();
      const secondDialog = await accepted;
      assert.match(secondDialog.message(), /cambios sin guardar/i);
      await secondDialog.accept();
      await confirmClick;
      await page.waitForURL(url => url.pathname === detail, { timeout: 20000 });
      const target = new URL(page.url());
      assert.equal(target.searchParams.get("returnTo"), returnTo);
      assert.equal(await prisma.qmsRecord.count({ where: { id: record.id } }), 1);
      console.log("C3 " + scenario.type + ": rechazar/aceptar salida, no guardado y contexto OK");
    }
    assert.deepEqual(errors, [], "La navegación C3 no debe producir errores de cliente/hidratación");
  } finally {
    await browser.close();
    const scope = { qmsRecordId: { in: ids } };
    await prisma.changeHistory.deleteMany({ where: scope });
    await prisma.qmsRecordVersion.deleteMany({ where: scope });
    await prisma.deviation.deleteMany({ where: scope });
    await prisma.capa.deleteMany({ where: scope });
    await prisma.changeControl.deleteMany({ where: scope });
    await prisma.complaint.deleteMany({ where: scope });
    await prisma.returnRecord.deleteMany({ where: scope });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
