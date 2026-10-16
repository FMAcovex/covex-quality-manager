import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { parseMasterForm, parseRevisionForm } from "../src/modules/controlled-documents/domain";
import { saveMaster, saveRevision } from "../src/modules/controlled-documents/service";
import { listDocuments } from "../src/modules/controlled-documents/queries";
const actor = "P1A prueba ficticia";
function master(values: Record<string, string> = {}) {
    const f = new FormData();
    for (const [k, v] of Object.entries({ actor, operation: "DRAFT", ...values }))
        f.set(k, v);
    return parseMasterForm(f);
}
function revision(values: Record<string, string> = {}) {
    const f = new FormData();
    for (const [k, v] of Object.entries({ actor, operation: "DRAFT", revisionCode: "00", changeReason: "Prueba documental ficticia", ...values }))
        f.set(k, v);
    return parseRevisionForm(f);
}
async function main() {
    const dep = await prisma.department.create({ data: { code: `QA-${randomUUID()}`, name: "Departamento de prueba", isActive: true } });
    // Explicit family used exclusively by this smoke; no real PNT is imported.
    const code = `QA-99/${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
    const historic = await prisma.department.create({ data: { code: `HIST-${randomUUID()}`, name: "Departamento histórico ficticio", isActive: false } });
    const ids: string[] = [];
    try {
        const draft = await saveMaster(master());
        ids.push(draft);
        const d = await prisma.controlledDocument.findUniqueOrThrow({ where: { id: draft }, include: { revisions: true } });
        assert.equal(d.baseCode, null);
        assert.equal(d.revisions.length, 0);
        await saveMaster(master({ operation: "EDIT", updatedAt: d.updatedAt.toISOString(), changeReason: "Completar después", title: "Borrador incompleto" }), draft);
        assert.equal((await prisma.controlledDocument.findUniqueOrThrow({ where: { id: draft } })).administrativeStatus, "DRAFT");
        // Department family must match the document code.
        await prisma.department.update({ where: { id: dep.id }, data: { code: "QA-99" } });
        const input = master({ operation: "REGISTER", baseCode: code, title: "Procedimiento ficticio", departmentId: dep.id, revisionCode: "00", changeReason: "Registro vigente real contrastado", existingDocument: "on", verified: "on", sourceReference: "Referencia ficticia QA", effectiveFrom: "2026-01-01", reviewDueAt: "2031-01-01" });
        const id = await saveMaster(input);
        ids.push(id);
        let m = await prisma.controlledDocument.findUniqueOrThrow({ where: { id }, include: { revisions: true, changes: true } });
        const initial = m.revisions[0];
        assert.equal(initial.revisionCode, "00");
        assert.equal(initial.status, "IN_FORCE");
        assert.equal(m.changes.length, 2);
        await assert.rejects(saveMaster(input));
        await assert.rejects(saveRevision(id, revision({ revisionCode: "02", existingDocument: "on", verified: "on", sourceReference: "Fuente ficticia", effectiveFrom: "2025-12-31" })), /antes que la revisión vigente anterior/);
        // D-085: registrar como vigente una revisión histórica posterior deja obsoleta la vigente anterior.
        const successionCode = `QA-99/${String((Number(code.slice(-3)) + 500) % 1000).padStart(3, "0")}`;
        const legacy = (revisionCode: string, effectiveFrom: string) => revision({ revisionCode, existingDocument: "on", existingStatus: "IN_FORCE", verified: "on", sourceReference: "Fuente ficticia", effectiveFrom, changeReason: `Revisión ${revisionCode} vigente contrastada` });
        const succession = await saveMaster(master({ operation: "REGISTER", baseCode: successionCode, title: "Sucesión ficticia", departmentId: dep.id, revisionCode: "00", changeReason: "Registro vigente real contrastado", existingDocument: "on", existingStatus: "IN_FORCE", verified: "on", sourceReference: "Fuente ficticia", effectiveFrom: "2025-01-01" }));
        ids.push(succession);
        const r00 = await prisma.controlledDocumentRevision.findFirstOrThrow({ where: { documentId: succession, revisionCode: "00" } });
        await assert.rejects(saveRevision(succession, legacy("01", "2024-12-31")), /antes que la revisión vigente anterior/);
        assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r00.id } })).status, "IN_FORCE");
        const r01 = await saveRevision(succession, legacy("01", "2026-02-01"));
        assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r00.id } })).status, "OBSOLETE");
        assert.equal((await prisma.controlledRevisionLifecycle.findUniqueOrThrow({ where: { revisionId: r00.id } })).obsoletedAt?.toISOString().slice(0, 10), "2026-02-01");
        assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: r01 } })).status, "IN_FORCE");
        assert.equal(await prisma.controlledDocumentChange.count({ where: { revisionId: r00.id, action: "Obsoleta por registro histórico de revisión posterior" } }), 1);
        const r03 = await saveRevision(succession, legacy("03", "2026-03-01"));
        await assert.rejects(saveRevision(succession, legacy("02", "2026-03-01")), /ya está vigente y es posterior/);
        assert.deepEqual((await prisma.controlledDocumentRevision.findMany({ where: { documentId: succession }, orderBy: { revisionCode: "asc" } })).map(r => [r.revisionCode, r.status]), [["00", "OBSOLETE"], ["01", "OBSOLETE"], ["03", "IN_FORCE"]]);
        assert.ok(r03);
        const following = await saveRevision(id, revision({ revisionCode: "01", previousRevisionId: initial.id, effectiveFrom: "2030-01-01", reviewDueAt: "2035-01-01" }));
        assert.ok(following);
        const prepared = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: following } });
        assert.equal(prepared.status, "DRAFT");
        assert.equal(prepared.effectiveFrom?.toISOString().slice(0, 10), "2030-01-01");
        await saveRevision(id, revision({ revisionCode: "01", updatedAt: prepared.updatedAt.toISOString(), revisionReason: "Borrador actualizado", effectiveFrom: "2030-01-01", reviewDueAt: "2035-01-01", previousRevisionId: initial.id }), following);
        assert.equal((await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: following } })).id, following);
        await assert.rejects(saveRevision(id, revision({ revisionCode: "02" })));
        await assert.rejects(saveRevision(id, revision({ revisionCode: "00", updatedAt: initial.updatedAt.toISOString() }), initial.id));
        await prisma.department.update({ where: { id: dep.id }, data: { code: "QM-99", name: "Nombre posterior", isActive: false } });
        m = await prisma.controlledDocument.findUniqueOrThrow({ where: { id }, include: { revisions: true, changes: true } });
        await saveMaster(master({ operation: "EDIT", baseCode: code, title: "Título posterior", departmentId: dep.id, updatedAt: m.updatedAt.toISOString(), changeReason: "Cambio del maestro" }), id);
        assert.deepEqual(await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: initial.id } }), initial);
        assert.equal((await prisma.controlledDocument.findUniqueOrThrow({ where: { id } })).departmentNameSnapshot, "Departamento de prueba");
        await prisma.department.update({ where: { id: historic.id }, data: { code: "QH-99" } });
        await assert.rejects(saveMaster(master({ departmentId: historic.id, baseCode: "QH-99/001" })));
        const old = await saveMaster(master({ operation: "REGISTER", departmentId: historic.id, baseCode: "QH-99/001", title: "Histórico ficticio", revisionCode: "00", existingDocument: "on", existingStatus: "OBSOLETE", verified: "on", sourceReference: "Fuente histórica", changeReason: "Registro histórico" }));
        ids.push(old);
        assert.equal((await prisma.department.findUniqueOrThrow({ where: { id: historic.id } })).isActive, false);
        await assert.rejects(saveRevision(id, revision({ revisionCode: "02", previousRevisionId: (await prisma.controlledDocumentRevision.findFirstOrThrow({ where: { documentId: old } })).id })));
        await assert.rejects(saveMaster(master({ operation: "EDIT", baseCode: code, title: "Desactualizado", departmentId: dep.id, updatedAt: m.updatedAt.toISOString(), changeReason: "Conflicto" }), id));
        assert.equal((await listDocuments({ q: code, department: dep.id, state: "ACTIVE", revision: "00", revisionState: "IN_FORCE", validity: "current" })).count, 1);
        assert.equal((await listDocuments({ q: code, revision: "01", revisionState: "IN_FORCE" })).count, 0);
        assert.equal((await listDocuments({ q: "Histórico ficticio", validity: "missing" })).count, 1);
        const batch = Array.from({ length: 301 }, () => ({ id: randomUUID(), title: `P1A pagination ${dep.id}`, createdByText: actor }));
        ids.push(...batch.map(x => x.id));
        await prisma.controlledDocument.createMany({ data: batch });
        const page = await listDocuments({ q: `P1A pagination ${dep.id}`, page: "13" });
        assert.equal(page.count, 301);
        assert.equal(page.rows.length, 1);
        assert.equal(page.pages, 13);
        const before = await prisma.controlledDocumentChange.count({ where: { documentId: id } });
        await assert.rejects(saveRevision(id, revision({ revisionCode: "01" })));
        assert.equal(await prisma.controlledDocumentChange.count({ where: { documentId: id } }), before);
        console.log("P1A PostgreSQL OK: borrador, registro, 00, unicidad, vigente + elaboración, sucesión de vigentes históricas, departamentos históricos, snapshots inmutables, conflicto, historial atómico, filtros y paginación SQL >300.");
    }
    finally {
        // Cleanup confined to the UUIDs created by this test; the application has no delete action.
        await prisma.controlledDocumentChange.deleteMany({ where: { documentId: { in: ids } } });
        await prisma.controlledRevisionLifecycle.deleteMany({ where: { documentId: { in: ids } } });
        await prisma.controlledDocumentRevision.updateMany({ where: { documentId: { in: ids } }, data: { previousRevisionId: null } });
        await prisma.controlledDocumentRevision.deleteMany({ where: { documentId: { in: ids } } });
        await prisma.controlledDocument.deleteMany({ where: { id: { in: ids } } });
        await prisma.department.deleteMany({ where: { id: { in: [dep.id, historic.id] } } });
    }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
