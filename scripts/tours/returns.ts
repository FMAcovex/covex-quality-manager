// Recorrido de Devoluciones (D-138): recepción de la devolución comercial con su producto y lote, abierta con su
// código → comprobaciones de reintegración, decisión de Garantía de Calidad (rechazo y destrucción), trazabilidad y
// cierre → Anexo III (formulario), Anexo IV (hoja del producto) y listado filtrado. Cada paso comprueba en la base de
// datos y en los documentos lo que el usuario ve.
//
//   Prueba (CI):  pnpm tour:returns
//   Vídeo (demo): TOUR_VIDEO_DIR=<carpeta> pnpm tour:returns
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { isActiveTemplateAssetReady, templateAssetReady } from "../../src/modules/configuration/template-readiness";
import { finishTour, ooxmlText, startTour, waitForSaved, type Tour } from "./lib";

const madridDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
// Una sola fecha «de hoy» para rellenar y comprobar, aunque el recorrido cruce la medianoche.
const today = madridDay();
// Texto de un DOCX o XLSX generado (los anexos de Devoluciones pueden ser de uno u otro tipo).
const documentText = (bytes: Buffer) => ooxmlText(bytes, /^(word\/document|xl\/sharedStrings|xl\/worksheets\/sheet\d+)\.xml$/);

// Comprobaciones de la sección 4: envases dañados en el transporte; el resto conforme.
const CHECKS: [string, "YES" | "NO" | "NA"][] = [
  ["withinAcceptedReturnPeriod", "YES"], ["roomTemperatureWithinTenDays", "YES"], ["packagingIntegrityOk", "NO"],
  ["customerDeclarationAvailable", "NA"], ["storageTransportConditionsOk", "NO"], ["noUseDamageContamination", "NO"],
  ["noRecallAlertBlock", "YES"], ["expiryAcceptable", "YES"],
];

async function main() {
  const tour = await startTour("Recorrido Devoluciones");
  const { page } = tour;
  const marker = tour.demo ? `REC-${randomUUID().slice(0, 4).toUpperCase()}` : `TOUR-DV-${randomUUID().slice(0, 8)}`;
  let failure: unknown = null;
  try {
    // Devoluciones solo admite las áreas de almacén (LG-…).
    const warehouse = await prisma.department.findFirstOrThrow({ where: { isActive: true, code: { startsWith: "LG-" } }, orderBy: { code: "asc" } });
    const other = await otherReturnCode(tour, marker, warehouse);
    const lot = `L-${marker}`;
    const findReturn = () => prisma.returnRecord.findFirst({ where: { products: { some: { lot } } }, include: { qmsRecord: true, products: true } });

    // 1 · Recepción: cliente, condiciones y producto devuelto; abierta, recibe su código DEV/LG-…
    const opened = await tour.step("1 · Se registra la <b>devolución</b>: cliente, producto y lote recibidos", async () => {
      await tour.go("/returns");
      await tour.click(page.locator("main a", { hasText: "+ Nueva devolución" }).first());
      await page.waitForURL(/\/returns\/new/);
      await tour.select(page.locator('select[name="departmentId"]'), warehouse.id);
      await tour.fill(page.locator('input[name="communicationDate"]'), today);
      await tour.fill(page.locator('input[name="receivedAt"]'), today);
      const author = page.locator('input[name="createdByText"]');
      if (await author.getAttribute("readonly") === null && !(await author.inputValue())) await tour.fill(author, "Almacén (ficticio)");
      await tour.select(page.locator('select[name="returnType"]'), "COMMERCIAL");
      await tour.fill(page.locator('input[name="customerEntity"]'), "Farmacia Ejemplo (ficticia)");
      await tour.fill(page.locator('input[name="country"]'), "España");
      await tour.fill(page.locator('input[name="address"]'), "Avenida Ejemplo 10, Valencia (ficticia)");
      await tour.fill(page.locator('input[name="conservationConditions"]'), "Temperatura ambiente");
      await tour.fill(page.locator('input[name="deliveryNote"]'), `ALB-${marker}`);
      const product = page.locator(".return-product-card").first();
      await tour.select(product.getByLabel("Tipo de producto"), "MEDICINE");
      await tour.fill(product.getByLabel("Producto / código"), "Jarabe de ejemplo 100 ml");
      await tour.fill(product.getByLabel("Formato"), "Frasco de 100 ml");
      await tour.fill(product.getByLabel("Lote"), lot);
      await tour.fill(product.getByLabel("Caducidad / reanálisis"), "03/2028");
      await tour.fill(product.getByLabel("Cantidad"), "24");
      await tour.fill(product.getByLabel("Unidad"), "frascos");
      await tour.fill(page.locator('textarea[name="reasonObservations"]'), "La farmacia devuelve 24 frascos con el precinto roto tras un golpe en el transporte.");
      await tour.fill(page.locator('textarea[name="attachedDocumentation"]'), "Albarán de devolución y fotografías de la recepción (ficticios).");
      await tour.select(page.locator('select[name="destinationKind"]'), "DESTROY");
      await tour.select(page.locator('select[name="status"]'), "OPEN");
      await tour.click(page.getByRole("button", { name: /^Guardar/ }).last());
      await page.waitForURL(/\/returns\/[0-9a-f-]{36}(\?|$)/);
      const row = await waitForSaved(findReturn, "la devolución");
      assert.equal(row.status, "OPEN");
      assert.match(row.qmsRecord.businessCode ?? "", /^DEV\/LG-/, "recibe su código DEV/LG-…");
      assert.deepEqual(row.products.map((p) => [p.productNameCode, p.lot, p.quantity]), [["Jarabe de ejemplo 100 ml", lot, "24"]]);
      const code = row.qmsRecord.businessCode ?? "";
      await page.getByText(code).first().waitFor();
      await tour.pause(1200);
      return { id: row.id, qmsRecordId: row.qmsRecordId, code, productId: row.products[0].id };
    });

    // 2 · Comprobaciones, decisión de Garantía de Calidad (rechazo y destrucción), trazabilidad y cierre.
    await tour.step("2 · <b>Comprobaciones</b> y <b>decisión</b>: se rechaza y se destruye; se cierra", async () => {
      await tour.click(page.locator("main a", { hasText: "Editar" }).first());
      await page.waitForURL(/\/edit/);
      // El formulario solo muestra las comprobaciones que aplican al producto y a sus condiciones.
      for (const [name, value] of CHECKS) {
        const check = page.locator(`select[name="${name}"]`);
        if (await check.isVisible()) await tour.select(check, value);
      }
      await tour.select(page.locator('select[name="decision"]'), "REJECTED");
      await tour.fill(page.locator('input[name="decisionDate"]'), today);
      await tour.fill(page.locator('textarea[name="finalDestination"]'), "Destrucción por gestor autorizado de residuos.");
      await tour.fill(page.locator('textarea[name="decisionObservations"]'), "Envases dañados y precinto roto: no se puede garantizar la integridad del producto.");
      await tour.fill(page.locator('input[name="qaApprovalName"]'), "Garantía de Calidad (ficticio)");
      await tour.fill(page.locator('input[name="destructionManagedBy"]'), "Gestor de residuos autorizado (ficticio)");
      await tour.fill(page.locator('textarea[name="destructionCertificate"]'), `Certificado de destrucción CD-${marker} (ficticio).`);
      await tour.select(page.locator('select[name="traceabilityUpdated"]'), "YES");
      await tour.fill(page.locator('input[name="closedAt"]'), today);
      await tour.select(page.locator('select[name="status"]'), "CLOSED");
      await tour.select(page.locator('select[name="dataQualityStatus"]'), "COMPLETE");
      await tour.fill(page.locator('textarea[name="changeReason"]'), "Decisión y cierre de la devolución.");
      await tour.click(page.getByRole("button", { name: /^Guardar/ }).last());
      await page.waitForURL(/\/returns\/[0-9a-f-]{36}(\?|$)/);
      const row = await waitForSaved(async () => { const r = await prisma.returnRecord.findUnique({ where: { id: opened.id } }); return r?.status === "CLOSED" ? r : null; }, "el cierre de la devolución");
      assert.equal(row.decision, "REJECTED");
      assert.equal(row.closedAt?.toISOString().slice(0, 10), today);
      assert.equal(row.decisionDate?.toISOString().slice(0, 10), today);
      assert.equal(row.traceabilityUpdated, "YES");
      assert.equal(row.roomTemperatureWithinTenDays, "YES", "se guarda la comprobación de temperatura de un medicamento no procedente de mayorista");
      assert.equal(row.packagingIntegrityOk, "NO", "se guarda que los envases no están íntegros");
      assert.ok(row.destructionCertificate?.includes(`CD-${marker}`), "se guarda el certificado de destrucción");
      assert.equal(row.dataQualityStatus, "COMPLETE");
      await tour.pause(1500);
    });

    // 3 · Documentos: Anexo III (formulario), Anexo IV (hoja del producto) y listado filtrado.
    await tour.step("3 · Los documentos salen del expediente: <b>Anexos III y IV</b> y listado", async () => {
      await tour.go(`/returns/${opened.id}?tab=documents`);
      const templates = await prisma.returnRecord.findUniqueOrThrow({ where: { id: opened.id }, select: {
        annexIIITemplateVersion: { select: { fileName: true, filePath: true, checksum: true } },
        annexIVTemplateVersion: { select: { fileName: true, filePath: true, checksum: true } },
      } });
      for (const [link, type, assigned, expected] of [
        [page.locator("main a", { hasText: "Generar Anexo III" }).first(), "RETURN_ANNEX_III", templates.annexIIITemplateVersion, [opened.code, lot]],
        [page.locator(`main a[href*="/annex-iv?product=${opened.productId}"]`).first(), "RETURN_ANNEX_IV", templates.annexIVTemplateVersion, [opened.code, lot]],
      ] as const) {
        if (assigned ? templateAssetReady(assigned) : await isActiveTemplateAssetReady("RETURN", type)) {
          const file = await tour.download(link);
          const text = documentText(file.bytes);
          for (const value of expected) assert.ok(text.includes(value), `${type} contiene «${value}»`);
          if (type === "RETURN_ANNEX_III") await tour.showDocument(file.name, file.bytes, `<b>Anexo III</b> de ${opened.code}: formulario de devolución`);
        } else {
          await tour.click(link);
          await page.getByText("Plantilla oficial no disponible").first().waitFor();
          await tour.go(`/returns/${opened.id}?tab=documents`);
        }
      }
      await tour.go(`/returns?q=${encodeURIComponent(opened.code)}`);
      await page.locator("tr", { hasText: opened.code }).first().waitFor();
      await tour.click(page.locator("summary", { hasText: "Exportar" }));
      const list = await tour.download(page.locator("a", { hasText: "Listado simple · filtros actuales" }).first());
      const listText = ooxmlText(list.bytes, /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/);
      assert.ok(listText.includes(opened.code), "el listado filtrado contiene la devolución");
      assert.ok(!listText.includes(other), `el listado filtrado por ${opened.code} no incluye otras devoluciones (${other})`);
      await page.keyboard.press("Escape");
      await tour.caption(`El listado filtrado se descarga en Excel con <b>${opened.code}</b>`);
      await tour.pause(2500);
    });
    await tour.caption(`Recorrido completado: <b>${opened.code}</b> recibida, evaluada, rechazada y destruida con trazabilidad`);
    await tour.pause(3000);
    console.log(`Recorrido de Devoluciones correcto: ${opened.code}`);
  } catch (error) {
    failure = error;
  }
  await finishTour(failure, [
    () => tour.close(),
    async () => { if (!tour.demo) await cleanup(marker); },
    () => prisma.$disconnect(),
  ]);
}

/**
 * Código de otra devolución que no debe salir en el listado filtrado. En la demo, una de los ejemplos; en la base de
 * pruebas, una ficha mínima con la marca, creada antes de empezar y borrada al terminar.
 */
async function otherReturnCode(tour: Tour, marker: string, warehouse: { id: string; code: string; name: string }) {
  if (tour.demo) {
    const row = await prisma.returnRecord.findFirst({ where: { status: { not: "DRAFT" }, qmsRecord: { isActive: true, businessCode: { not: null } }, NOT: { products: { some: { lot: { startsWith: "L-REC-" } } } } }, include: { qmsRecord: true } });
    if (!row?.qmsRecord.businessCode) throw new Error("La demo no tiene ninguna devolución de ejemplo: carga los ejemplos de la demo antes de grabar el recorrido.");
    return row.qmsRecord.businessCode;
  }
  const code = `DEV-TOUR-${marker.slice(-8)}-2097`;
  await prisma.returnRecord.create({ data: {
    qmsRecord: { create: { recordType: "RETURN", businessCode: code, year: 2097 } },
    status: "OPEN", returnType: "COMMERCIAL", department: { connect: { id: warehouse.id } }, departmentCodeSnapshot: warehouse.code, departmentNameSnapshot: warehouse.name,
    communicationDate: new Date("2097-01-01"), createdByText: "Recorrido de Devoluciones", customerEntity: "Cliente del recorrido",
    products: { create: [{ productType: "OTHER", productNameCode: "Producto del recorrido", lot: `L-${marker}-OTRA` }] },
  } });
  return code;
}

/** Solo en la base aislada de pruebas: borra lo creado con la marca, también si el recorrido falló a medias. */
async function cleanup(marker: string) {
  const returns = await prisma.returnRecord.findMany({ where: { products: { some: { lot: { contains: marker } } } }, select: { id: true, qmsRecordId: true } });
  if (!returns.length) return;
  const ids = returns.map((row) => row.qmsRecordId), returnIds = returns.map((row) => row.id);
  await prisma.qmsRelation.deleteMany({ where: { OR: [{ sourceRecordId: { in: ids } }, { targetRecordId: { in: ids } }] } });
  await prisma.changeHistory.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.generatedDocument.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: { in: ids } } });
  await prisma.returnFollowup.deleteMany({ where: { returnRecordId: { in: returnIds } } });
  await prisma.returnProduct.deleteMany({ where: { returnRecordId: { in: returnIds } } });
  await prisma.returnRecord.deleteMany({ where: { id: { in: returnIds } } });
  await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
}

main().catch((error) => { console.error(error); process.exit(1); });
