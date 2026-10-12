import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "./auth-fixtures/browser";
import { type Page } from "playwright";
import { prisma } from "../src/lib/db";
import { qaOnly, manualMaster, evidence, planRevision, decideLifecycle, nextRevision } from "../src/modules/controlled-documents/testing/p2c";

const base = process.env.P3C1_UI_BASE_URL || "http://127.0.0.1:3000";
const screenshots = process.env.P3C1_SCREENSHOT_DIR;

async function checkPage(page: Page, path: string | null, name: string, width: number) {
  if (path) await page.goto(`${base}${path}`);
  await page.locator("main h1").waitFor();
  await page.evaluate(() => document.fonts.ready);
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth }));
  assert.ok(dimensions.body <= dimensions.viewport + 1, `${name}/${width}: desbordamiento global ${dimensions.body}`);
  // Hit testing catches a control covered by a neighbouring fieldset, even when both are visible.
  // A collapsed <details> keeps its inputs in the DOM, but they have no layout box.
  // Validate all rendered controls, including advanced filters after expanding them.
  const controls = page.locator('.pnt-workspace .field :is(input, select, textarea):visible, .pnt-workspace .pnt-check input:visible');
  for (const control of await controls.all()) {
    assert.equal(await control.evaluate(element => {
      const r = element.getBoundingClientRect(), label = element.closest("label");
      const top = label?.getBoundingClientRect().top ?? r.top;
      return Boolean(label?.textContent?.trim()) && r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1 && top <= r.top;
    }), true, `${name}/${width}: campo o etiqueta fuera de distribución`);
    await control.scrollIntoViewIfNeeded();
    assert.equal(await control.evaluate(element => {
      const r = element.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === element;
    }), true, `${name}/${width}: campo cubierto`);
  }
  await page.evaluate(() => scrollTo(0, 0));
  if (screenshots) await page.screenshot({ path: `${screenshots}/${width}-${name}.png`, fullPage: true });
}

async function main() {
  qaOnly();
  if (screenshots) await mkdir(screenshots, { recursive: true });
  const { master } = await manualMaster(), revision = master.revisions[0];
  const files = await evidence(master.id, revision.id), ids = files.map(f => f.id);
  await planRevision(master.id, revision.id, ids, files[2].id);
  await decideLifecycle(master.id, revision.id, ids, { operation: "ACTIVATE", previousRevisionId: null });
  const draftId = await nextRevision(master.id, revision.id);
  const snapshot = async () => JSON.stringify(await prisma.controlledDocument.findUniqueOrThrow({ where: { id: master.id }, include: { revisions: { orderBy: { revisionCode: "desc" }, include: { lifecycle: true, documents: { orderBy: { id: "asc" } }, decisions: { orderBy: { sequence: "asc" } } } } } }));
  const before = await snapshot(), browser = await chromium.launch({ headless: true });
  const page = await browser.newPage(); page.setDefaultTimeout(20000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  try {
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await checkPage(page, "/controlled-documents/new", "new", width);
      assert.equal(await page.locator(".pnt-form-grid").first().evaluate(e => getComputedStyle(e).gridTemplateColumns.split(" ").length), width === 390 ? 1 : 2);
      await page.getByRole("checkbox", { name: "Registrar revisión documental ya existente", exact: true }).check();
      await page.getByLabel(/^Estado documental existente/).waitFor();
      await checkPage(page, null, "new-existing", width);
      await checkPage(page, `/controlled-documents/${master.id}/edit`, "edit", width);
      await checkPage(page, `/controlled-documents/${master.id}/revisions/new`, "new-revision", width);
      await checkPage(page, `/controlled-documents/${master.id}/revisions/${draftId}/edit`, "edit-revision", width);
      for (const tab of ["information", "revisions", "documents", "verification", "history"]) {
        await checkPage(page, `/controlled-documents/${master.id}?tab=${tab}`, tab, width);
        const active = page.locator('.pnt-record-tabs a[aria-current="page"]');
        if (tab !== "verification") {
          assert.equal(await active.count(), 1);
          assert.ok((await active.getAttribute("href"))?.endsWith(`tab=${tab}`));
          assert.equal(await active.evaluate(e => getComputedStyle(e).borderBottomColor), "rgb(13, 99, 206)");
        } else assert.equal(await active.count(), 0);
        for (const link of await page.locator(".pnt-record-tabs a").all()) {
          const box = await link.boundingBox(); assert.ok(box && box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1);
        }
      }
      await page.goto(`${base}/controlled-documents?q=${encodeURIComponent(master.baseCode!)}`);
      const advanced = page.locator("details.pnt-advanced-filters");
      assert.equal(await advanced.count(), 1);
      assert.equal(await advanced.evaluate(element => (element as HTMLDetailsElement).open), false, "Los filtros avanzados se muestran plegados inicialmente.");
      await checkPage(page, null, "list", width);
      await advanced.locator("summary").click();
      assert.equal(await advanced.evaluate(element => (element as HTMLDetailsElement).open), true);
      await checkPage(page, null, "list-advanced", width);
      const recordLinks = page.getByRole("link", { name: master.baseCode!, exact: true });
      await recordLinks.first().waitFor();
      assert.equal(await recordLinks.count(), 2, "El listado debe mostrar las revisiones 00 y 01 en filas independientes.");
      assert.deepEqual(await page.locator(".pnt-list-table tbody tr td:nth-child(5)").allTextContents(), ["01", "00"]);
      const region = page.getByRole("region", { name: "Listado maestro PNT; desplazamiento horizontal", exact: true });
      const sizes = await region.evaluate(e => ({ client: e.clientWidth, scroll: e.scrollWidth, overflow: getComputedStyle(e).overflowX }));
      assert.equal(sizes.overflow, "auto");
      if (width < 1000) {
        assert.ok(sizes.scroll > sizes.client);
        await region.focus(); await page.keyboard.press("ArrowRight");
        await page.waitForFunction(() => document.querySelector(".pnt-table-scroll")!.scrollLeft > 0);
      }
      await page.keyboard.press("Tab");
      await page.getByRole("link", { name: "Nuevo PNT", exact: true }).focus();
      assert.equal(await page.getByRole("link", { name: "Nuevo PNT", exact: true }).evaluate(e => e.matches(":focus-visible") && getComputedStyle(e).outlineStyle === "solid"), true);
      await page.keyboard.press("Enter");
      await page.waitForURL(url => url.origin === new URL(base).origin && url.pathname === "/controlled-documents/new");
      assert.equal(new URL(page.url()).searchParams.get("returnTo"), "/controlled-documents?q=" + encodeURIComponent(master.baseCode!), "El alta conserva la búsqueda del listado.");
    }
    assert.equal(await snapshot(), before, "La lectura/presentación conserva estados, UUID, snapshots, decisiones y documentos.");
    assert.deepEqual(errors, []);
    console.log("P3C-1 Chromium OK: listado, alta/edición, alta/edición de revisión y cinco pestañas a 1440/768/390; sin desbordamiento global ni campos cubiertos, etiquetas, pestaña activa, scroll de tabla por teclado y foco visible; lectura sin cambios de estado/snapshots.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
