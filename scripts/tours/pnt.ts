// Recorrido de PNT · Documentación controlada (D-138): nuevo PNT con su revisión 00 en borrador → quién la elabora,
// revisa y aprueba (aparece en «Mis tareas») → documento de la revisión → estado «Vigente» registrado según la
// aprobación externa (sin firma electrónica) → biblioteca filtrada por vigencia y descarga en Excel. Cada paso
// comprueba en la base de datos y en el Excel lo que el usuario ve. No borra lo que crea (ver el final de main).
//
//   Prueba (CI):  pnpm tour:pnt
//   Vídeo (demo): TOUR_VIDEO_DIR=<carpeta> pnpm tour:pnt
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { finishTour, ooxmlText, serverSafeDay, startTour, waitForSaved } from "./lib";

const madridDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
// El servidor rechaza una vigencia futura y calcula «hoy» en UTC: la vigencia usa la fecha que aceptan los dos.
const effectiveDay = serverSafeDay();
// PDF mínimo ficticio para la revisión (el recorrido no usa documentos reales).
const PDF = Buffer.from("%PDF-1.4\n% Documento ficticio del recorrido de PNT\n%%EOF");

async function main() {
  const tour = await startTour("Recorrido PNT");
  const { page } = tour;
  const marker = tour.demo ? `REC-${randomUUID().slice(0, 4).toUpperCase()}` : `TOUR-PNT-${randomUUID().slice(0, 8)}`;
  let failure: unknown = null;
  try {
    const department = await prisma.department.findFirst({ where: { isActive: true, code: "PM-10" } })
      ?? await prisma.department.findFirstOrThrow({ where: { isActive: true }, orderBy: { code: "asc" } });
    // Código libre en la serie 900–999 del departamento, para no chocar con los PNT de ejemplo ni con otras pruebas.
    let baseCode = "";
    for (let n = 900; n < 1000 && !baseCode; n++) if (!await prisma.controlledDocument.findUnique({ where: { baseCode: `${department.code}/${n}` } })) baseCode = `${department.code}/${n}`;
    assert.ok(baseCode, `no queda ningún código libre ${department.code}/900–999 para el PNT del recorrido: vuelve a crear la base de pruebas o la demo`);
    const assignedToMe = `/controlled-documents?assigned=me&q=${encodeURIComponent(baseCode)}`;
    const title = `Limpieza y verificación de la prensa rotativa (ficticio ${marker})`;
    const findDocument = () => prisma.controlledDocument.findFirst({ where: { baseCode }, include: { revisions: { include: { documents: true } } } });
    const session = await (await page.request.get(`${tour.base}/api/auth/session`)).json() as { name?: string };
    assert.ok(session.name, "hay una sesión con nombre");

    // 1 · Alta del PNT con su revisión 00, en borrador.
    await tour.step("1 · Se da de alta el <b>PNT</b> con su revisión 00, en borrador", async () => {
      await tour.go("/controlled-documents");
      await tour.click(page.locator("main a", { hasText: "Nuevo PNT" }).first());
      await page.waitForURL(/\/controlled-documents\/new/);
      await tour.fill(page.locator('input[name="baseCode"]'), baseCode);
      await tour.select(page.locator('select[name="departmentId"]'), department.id);
      await tour.fill(page.locator('input[name="title"]'), title);
      await tour.fill(page.locator('input[name="revisionCode"]'), "00");
      await tour.fill(page.locator('textarea[name="revisionReason"]'), "Edición inicial del procedimiento.");
      const actor = page.locator('input[name="actor"]');
      if (await actor.getAttribute("readonly") === null && !(await actor.inputValue())) await tour.fill(actor, "Garantía de Calidad (ficticio)");
      await tour.fill(page.locator('textarea[name="changeReason"]'), "Alta del procedimiento nuevo.");
      await tour.click(page.getByRole("button", { name: "Registrar PNT" }));
      await page.waitForURL(/\/controlled-documents\/[0-9a-f-]{36}(\?|$)/);
      const row = await waitForSaved(findDocument, "el PNT");
      assert.equal(row.title, title);
      assert.deepEqual(row.revisions.map((r) => [r.revisionCode, r.status]), [["00", "DRAFT"]], "nace con la revisión 00 en borrador");
      await page.getByText(baseCode).first().waitFor();
      await tour.pause(1200);
    });
    const document = await findDocument();
    const id = document!.id, revisionId = document!.revisions[0].id;

    // 2 · Responsables: quién elabora, revisa y aprueba; la elaboración aparece en «Mis tareas».
    await tour.step("2 · Se asigna quién <b>elabora</b>, <b>revisa</b> y <b>aprueba</b>", async () => {
      await tour.go(`/controlled-documents/${id}?tab=revisions`);
      await tour.click(page.locator("main a", { hasText: "Asignar responsables" }).first());
      await page.waitForURL(/\/assignments\/edit/);
      const me = page.locator(`select[name="${revisionId}.preparationResponsibleUserId"]`);
      const myOption = await me.locator("option").filter({ hasText: session.name! }).first().getAttribute("value");
      assert.ok(myOption, "el usuario de la sesión aparece en la lista de usuarios");
      await tour.select(me, myOption!);
      await tour.fill(page.locator(`input[name="${revisionId}.preparationTargetDate"]`), madridDay(7));
      await tour.fill(page.locator(`input[name="${revisionId}.reviewResponsible"]`), "Responsable de Producción (ficticio)");
      await tour.fill(page.locator(`input[name="${revisionId}.reviewTargetDate"]`), madridDay(14));
      await tour.fill(page.locator(`input[name="${revisionId}.approvalResponsible"]`), "Dirección Técnica (ficticio)");
      await tour.fill(page.locator(`input[name="${revisionId}.approvalTargetDate"]`), madridDay(21));
      const actor = page.locator('input[name="actor"]');
      if (await actor.getAttribute("readonly") === null && !(await actor.inputValue())) await tour.fill(actor, "Garantía de Calidad (ficticio)");
      await tour.click(page.getByRole("button", { name: "Guardar responsables" }));
      await page.waitForURL(/\/controlled-documents\/[0-9a-f-]{36}(\?|$)/);
      const revision = await waitForSaved(async () => { const r = await prisma.controlledDocumentRevision.findUnique({ where: { id: revisionId } }); return r?.preparationResponsibleUserId ? r : null; }, "los responsables");
      assert.equal(revision.preparationResponsibleUserId, myOption);
      assert.equal(revision.reviewResponsible, "Responsable de Producción (ficticio)");
      assert.equal(revision.approvalResponsible, "Dirección Técnica (ficticio)");
      // En la biblioteca, «Asignadas a mí» lo muestra mientras la revisión está en elaboración, y la tarea aparece en
      // «Mis tareas» del panel de inicio.
      await tour.go(assignedToMe);
      await page.locator("main a", { hasText: baseCode }).first().waitFor();
      await tour.go("/");
      const myTasks = page.locator("section", { has: page.locator("#dashboard-my-tasks-title") }).first();
      await myTasks.getByText(baseCode).first().waitFor();
      await myTasks.scrollIntoViewIfNeeded();
      await tour.caption("La elaboración aparece en <b>Asignadas a mí</b> y en <b>Mis tareas</b>");
      await tour.pause(2000);
    });

    // 3 · Documento de la revisión.
    await tour.step("3 · Se incorpora el <b>documento</b> de la revisión", async () => {
      await tour.go(`/controlled-documents/${id}?tab=documents`);
      const form = page.locator("form").filter({ has: page.locator('input[name="file"]') }).first();
      await tour.select(form.locator('select[name="kind"]'), "DOCUMENT_PDF");
      await form.locator('input[name="file"]').setInputFiles({ name: `${baseCode.replace("/", "-")}-00.pdf`, mimeType: "application/pdf", buffer: PDF });
      await tour.fill(form.locator('textarea[name="description"]'), "PDF de la revisión 00 aprobada (ficticio).");
      await tour.click(form.getByRole("button", { name: "Añadir documento" }));
      const documents = await waitForSaved(async () => { const r = await prisma.controlledRevisionDocument.findMany({ where: { revisionId } }); return r.length ? r : null; }, "el documento de la revisión");
      assert.deepEqual(documents.map((d) => [d.kind, d.originalName]), [["DOCUMENT_PDF", `${baseCode.replace("/", "-")}-00.pdf`]]);
      // La ficha muestra el documento incorporado.
      await page.locator("a", { hasText: `${baseCode.replace("/", "-")}-00.pdf` }).first().waitFor();
      await tour.pause(1500);
    });

    // 4 · Estado vigente registrado según la aprobación externa.
    await tour.step("4 · Aprobado fuera de la aplicación, se registra <b>Vigente</b> con sus fechas", async () => {
      await tour.go(`/controlled-documents/${id}?tab=information`);
      await tour.select(page.getByLabel("Estado de la revisión 00"), "IN_FORCE");
      await tour.fill(page.getByLabel("Fecha de vigencia real"), effectiveDay);
      await tour.fill(page.getByLabel("Próxima revisión (si consta)"), madridDay(3 * 365));
      await tour.fill(page.getByPlaceholder("Identifique la evidencia externa que acredita este estado"), "Revisión 00 aprobada y firmada en papel por Dirección Técnica (ficticio).");
      await tour.click(page.getByRole("button", { name: "Guardar estado manual" }));
      const revision = await waitForSaved(async () => { const r = await prisma.controlledDocumentRevision.findUnique({ where: { id: revisionId }, include: { lifecycle: true } }); return r?.status === "IN_FORCE" ? r : null; }, "el estado Vigente");
      const effective = (revision.lifecycle?.effectiveFrom ?? revision.effectiveFrom)?.toISOString().slice(0, 10);
      assert.equal(effective, effectiveDay, "vigente desde hoy");
      await page.locator(".pnt-manual-revision").getByText("Vigente").first().waitFor();
      // Ya vigente, la elaboración deja de ser una tarea: «Asignadas a mí» no lo muestra.
      await tour.go(assignedToMe);
      await page.locator(".pnt-empty").waitFor();
      assert.equal(await page.locator("main a", { hasText: baseCode }).count(), 0, "una revisión vigente no queda en «Asignadas a mí»");
      await tour.go(`/controlled-documents/${id}?tab=information`);
      await tour.pause(1500);
    });

    // 5 · Biblioteca: el PNT aparece entre los de vigencia iniciada y en el Excel descargado.
    await tour.step("5 · En la <b>biblioteca</b>: vigente y en el Excel descargado", async () => {
      await tour.go(`/controlled-documents?validity=current&q=${encodeURIComponent(baseCode)}`);
      await page.locator("main a", { hasText: baseCode }).first().waitFor();
      const file = await tour.download(page.locator("main a", { hasText: "Descargar .xlsx" }).first());
      const text = ooxmlText(file.bytes, /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/);
      for (const value of [baseCode, title]) assert.ok(text.includes(value), `el Excel contiene «${value}»`);
      await tour.caption(`El Excel de la biblioteca incluye <b>${baseCode}</b> vigente`);
      await tour.pause(2500);
    });
    await tour.caption(`Recorrido completado: <b>${baseCode}</b> dado de alta, asignado, documentado y vigente`);
    await tour.pause(3000);
    console.log(`Recorrido de PNT correcto: ${baseCode}`);
  } catch (error) {
    failure = error;
  }
  // Sin limpieza: las decisiones registradas sobre una revisión de PNT son inmutables por diseño (P2B; la base de
  // datos rechaza borrarlas). Como las pruebas de PNT existentes, el recorrido deja su PNT en la base de pruebas,
  // con un código propio de la serie 900 y la marca en el título; en CI la base se descarta al acabar el trabajo.
  await finishTour(failure, [
    () => tour.close(),
    () => prisma.$disconnect(),
  ]);
}

main().catch((error) => { console.error(error); process.exit(1); });
