import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { saveMaster } from "../src/modules/controlled-documents/service";
import { parseMasterForm } from "../src/modules/controlled-documents/domain";
import { previewFixture } from "../src/modules/controlled-documents/preview/synthetic-workbook";
import { previewIndex } from "../src/modules/controlled-documents/preview/service";
import { POST } from "../src/app/api/controlled-documents/index-preview/route";
async function snapshot() { return JSON.stringify(await Promise.all([prisma.controlledDocument.findMany({ orderBy: { id: "asc" } }), prisma.controlledDocumentRevision.findMany({ orderBy: { id: "asc" } }), prisma.controlledDocumentChange.findMany({ orderBy: { id: "asc" } }), prisma.department.findMany({ orderBy: { id: "asc" } })])); }
async function main() {
    if (process.env.APP_ENV !== "test")
        throw new Error("El smoke exige una base de datos QA aislada y APP_ENV=test.");
    const department = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });
    const sg = await prisma.department.create({ data: { code: "SG-20", name: "Departamento histórico ficticio", isActive: false } });
    let id: string | null = null;
    try {
        const f = new FormData();
        for (const [k, v] of Object.entries({ operation: "REGISTER", actor: "P1B prueba ficticia", baseCode: "GC-00/001", title: "Procedimiento ficticio", departmentId: department.id, revisionCode: "03", existingDocument: "on", verified: "on", sourceReference: "Fuente sintética", effectiveFrom: "2026-04-13", reviewDueAt: "2031-04-13", changeReason: "Fixture sintético para conciliación" }))
            f.set(k, v);
        id = await saveMaster(parseMasterForm(f));
        const before = await snapshot();
        const bytes = previewFixture();
        const report = await previewIndex(bytes, "synthetic.xlsx", undefined, "2026-10-08");
        assert.equal(report.rows.some(r => r.source.sheet === "GC-00"), false);
        assert.equal(report.rows.some(r => r.normalized.baseCode === "GC-00/999"), false);
        const gc = report.rows.find(r => r.normalized.baseCode === "GC-00/001")!;
        assert.equal(gc.source.sheet, "GC-00(");
        assert.equal(gc.normalized.departmentCode, "GC-00");
        assert.equal(gc.normalized.revisionCode, "03");
        assert.equal(gc.reconciliation.kind, "EXISTING_REVISION");
        assert.equal(gc.verificationStatus, "UNVERIFIED");
        assert.ok(gc.reconciliation.consolidated);
        assert.equal(report.summary.pntCandidates, 8);
        assert.equal(report.summary.uniqueCodes, 7);
        assert.equal(report.summary.additionalAppearances, 1);
        assert.equal(report.summary.revisionDiscrepancyGroups, 1);
        assert.ok(report.rows.find(r => r.normalized.baseCode === "SG-20/001")?.issues.includes("DEPARTMENT_INACTIVE"));
        assert.equal(await snapshot(), before);
        const repeat = await previewIndex(bytes, "synthetic.xlsx", undefined, "2026-10-08");
        assert.deepEqual(repeat, report);
        assert.equal(await snapshot(), before);
        const data = new FormData();
        data.set("file", new File([new Uint8Array(bytes)], "synthetic.xlsx"));
        const response = await POST(new Request("http://localhost/api/controlled-documents/index-preview", { method: "POST", body: data }));
        assert.equal(response.status, 200);
        assert.match(response.headers.get("cache-control")!, /no-store/);
        assert.equal((await response.json()).report.summary.pntCandidates, 8);
        assert.equal(await snapshot(), before);
        const bad = new FormData();
        bad.set("file", new File(["invalid"], "synthetic.xlsx"));
        assert.equal((await POST(new Request("http://localhost/api/controlled-documents/index-preview", { method: "POST", body: bad }))).status, 400);
        assert.equal(await snapshot(), before);
        console.log("P1B-1 PostgreSQL/API OK: exclusión GC-00, GC-00( normalizada, revisiones existentes consolidadas sin cambios, inactivos sin reactivar, informe repetible e idempotencia de previsualización, original no persistido; cero escrituras operativas.");
        if (process.env.P1B1_PRIVATE_XLSX_PATH) {
            const real = await previewIndex(readFileSync(process.env.P1B1_PRIVATE_XLSX_PATH), "ÍNDICE GENERAL 2025.xlsx", undefined, "2026-10-08");
            assert.equal(real.sheetCount, 42);
            assert.equal(real.interpretedSheets.length, 39);
            assert.ok(real.interpretedSheets.includes("GC-00("));
            assert.equal(real.interpretedSheets.includes("GC-00"), false);
            assert.equal(real.rows.some(r => r.source.sheet === "GC-00"), false);
            assert.equal(real.rows.every(r => r.verificationStatus === "UNVERIFIED"), true);
            assert.equal(await snapshot(), before);
            // Only aggregate statistics; no real workbook row or document content is logged.
            console.log(JSON.stringify({ privateWorkbook: "analyzed", sheets: real.interpretedSheets.length, summary: real.summary }));
        }
    }
    finally {
        if (id) {
            await prisma.controlledDocumentChange.deleteMany({ where: { documentId: id } });
            await prisma.controlledDocumentRevision.deleteMany({ where: { documentId: id } });
            await prisma.controlledDocument.delete({ where: { id } });
        }
        await prisma.department.delete({ where: { id: sg.id } });
    }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
