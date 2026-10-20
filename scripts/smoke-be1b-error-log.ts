import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { isolatedTestEnvironment, authConfiguration } from "../src/lib/auth/config";
import { chromium, authenticatedPage } from "./auth-fixtures/browser";

// D-113 (BE1-B): un error no controlado muestra una «Referencia técnica» y el servidor deja una línea con esa
// misma referencia, sin datos del expediente. Se provoca con una versión de informe ficticia y corrupta.
async function main() {
  assert(isolatedTestEnvironment(), "Exclusivamente base sintética aislada");
  const serverLog = process.env.BE1B_SERVER_LOG ?? "ci-evidence/browser-qms-server.log";
  const base = authConfiguration().origin, marker = "BE1B-" + randomUUID().slice(0, 8);
  const audit = await prisma.audit.create({ data: { qmsRecord: { create: { recordType: "AUDIT", businessCode: `${marker}-AUD`, year: 2026 } }, status: "OPEN", auditType: "INTERNAL", scenario: "INTERNAL_COVEX", title: marker } });
  await prisma.qmsRecordVersion.create({ data: { qmsRecordId: audit.qmsRecordId, sequenceNumber: 0, kind: "INITIAL", snapshot: { corrupto: marker }, createdByText: "Sintético BE1-B" } });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await authenticatedPage(browser);
    await page.goto(`${base}/audits/${audit.id}?tab=versions`);
    const reference = (await page.locator(".system-reference code").textContent({ timeout: 15000 }))?.trim();
    assert(reference, "La página de error muestra la referencia técnica");
    let line: Record<string, unknown> | undefined;
    for (let attempt = 0; attempt < 20 && !line; attempt++) {
      line = readFileSync(serverLog, "utf8").split("\n").filter(text => text.startsWith("{") && text.includes(reference)).map(text => JSON.parse(text) as Record<string, unknown>).find(entry => entry.ref === reference);
      if (!line) await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert(line, `El registro del servidor tiene la referencia ${reference}`);
    assert.equal(line.event, "request.unhandled");
    assert.equal(line.service, "covex-quality-manager");
    assert.match(String(line.operation), /\/audits\/\[id\]/);
    const raw = JSON.stringify(line);
    assert(!raw.includes(marker) && !raw.includes(audit.id), "Sin datos del expediente ni la URL real");
    console.log(`BE1-B OK: la referencia visible ${reference} está en el registro del servidor.`);
  } finally {
    await browser.close();
  }
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
