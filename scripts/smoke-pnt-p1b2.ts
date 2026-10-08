import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { createBatch, getBatch, decide, prepare, confirm, expireBatches } from "../src/modules/controlled-documents/import/service";
import { previewFixture, syntheticWorkbook, headings } from "../src/modules/controlled-documents/preview/synthetic-workbook";
import { saveMaster } from "../src/modules/controlled-documents/service";
import { parseMasterForm } from "../src/modules/controlled-documents/domain";
import { previewIndex } from "../src/modules/controlled-documents/preview/service";
import type { PreviewRow } from "../src/modules/controlled-documents/preview/types";
import type { Resolution } from "../src/modules/controlled-documents/import/domain";
const actor = "P1B-2 QA ficticio", batches: string[] = [], docs: string[] = [];
async function batch(bytes = previewFixture()) { const id = await createBatch(bytes,"synthetic.xlsx",actor); batches.push(id); return id; }
async function include(id: string, code: string, departmentId: string, change: Partial<Resolution> = {}, group = false) {
    const b = await getBatch(id), r = b.rows.find(r => r.baseCode === code)!, source = r.data as unknown as PreviewRow, n = source.normalized;
    await decide(id,{actor,version:b.version,sourceKey:r.sourceKey,decision:"INCLUDE",scope:group ? "GROUP" : "ROW",reason:"Fuente sintética revisada manualmente",resolution:{title:n.title,revisionCode:n.revisionCode || "",effectiveFrom:n.effectiveFrom || "",reviewDueAt:n.reviewDueAt || "",declaredState:n.declaredState,departmentId,reviewed:true,reason:"Incidencias y correspondencia revisadas; vacíos sin determinar",...change}});
}
async function request(id: string) { const p = await prepare(id); return {actor,version:p.version,token:p.token,eligibleKeys:p.eligibleKeys,explicitlyConfirmed:true}; }
async function businessSnapshot() { return JSON.stringify(await Promise.all([prisma.controlledDocument.findMany({orderBy:{id:"asc"}}),prisma.controlledDocumentRevision.findMany({orderBy:{id:"asc"}}),prisma.controlledDocumentChange.findMany({orderBy:{id:"asc"}})])); }
async function main() {
    if (process.env.APP_ENV !== "test") throw new Error("Se exige APP_ENV=test y PostgreSQL QA aislado.");
    const gc = await prisma.department.findUniqueOrThrow({where:{code:"GC-00"}}), sg = await prisma.department.create({data:{code:"SG-20",name:"Histórico QA sintético",isActive:false}});
    try {
        const id = await batch(), b = await getBatch(id);
        assert.equal((await prepare(id)).summary.conflicts,1); assert.equal((await prepare(id)).summary.writes,0);
        assert.equal(b.rows.length,9); assert.equal(b.rows.some(r => (r.data as unknown as PreviewRow).source.sheet === "GC-00"),false); assert.equal(b.rows.some(r => r.baseCode === "GC-00/999"),false);
        const other = b.rows.find(r => (r.data as unknown as PreviewRow).classification === "OTHER")!;
        await assert.rejects(decide(id,{actor,version:b.version,sourceKey:other.sourceKey,decision:"INCLUDE",scope:"ROW",reason:"No debe admitirse"}),/no PNT/);
        const unknown = b.rows.find(r => r.baseCode === "MC-20/001")!;
        assert.ok((unknown.data as unknown as PreviewRow).issues.includes("DEPARTMENT_UNKNOWN"));
        await assert.rejects(include(id,"MC-20/001","12345678-1234-4234-8234-123456789abc"),/departamento existente/);
        for (const code of ["GC-00/001","GC-00/002","GC-00/003","GC-00/004"]) await include(id,code,gc.id);
        await include(id,"SG-20/001",sg.id);
        // Explicitly choose revision 01 from the group, not its highest revision 02.
        const m = (await getBatch(id)).rows.find(r => r.baseCode === "MC-20/001" && (r.data as unknown as PreviewRow).normalized.revisionCode === "01")!;
        const latest = await getBatch(id); const n = (m.data as unknown as PreviewRow).normalized;
        await decide(id,{actor,version:latest.version,sourceKey:m.sourceKey,decision:"INCLUDE",scope:"GROUP",reason:"Seleccionar procedencia válida sintética y excluir la otra",resolution:{title:n.title,revisionCode:"01",effectiveFrom:n.effectiveFrom!,reviewDueAt:n.reviewDueAt!,declaredState:n.declaredState,departmentId:gc.id,reviewed:true,reason:"Correspondencia manual sintética elegida; no crear departamento"}});
        // Changing a selected source must first release the previous SQL-unique selection.
        for (const revision of ["02","01"]) { const switched = await getBatch(id), row = switched.rows.find(r=>r.baseCode === "MC-20/001" && (r.data as unknown as PreviewRow).normalized.revisionCode === revision)!; await decide(id,{actor,version:switched.version,sourceKey:row.sourceKey,decision:"INCLUDE",scope:"GROUP",reason:"Cambio explícito de procedencia QA",resolution:{title:n.title,revisionCode:revision,effectiveFrom:n.effectiveFrom!,reviewDueAt:n.reviewDueAt!,declaredState:n.declaredState,departmentId:gc.id,reviewed:true,reason:"Seleccionar fuente manualmente y excluir la anterior"}}); }
        const plan = await prepare(id); assert.equal(plan.summary.newDocuments,6); assert.equal(plan.summary.newRevisions,5); assert.equal(plan.summary.pending,1); assert.equal(plan.summary.excluded,2); assert.equal(plan.summary.businessWrites,22); assert.equal(plan.summary.writes,32);
        await assert.rejects(confirm(id,{...(await request(id)),explicitlyConfirmed:false}),/explícitamente/);
        await assert.rejects(confirm(id,{...(await request(id)),eligibleKeys:[other.sourceKey]}),/no coincide/);
        const input = await request(id); await confirm(id,input);
        const imported = await prisma.controlledDocument.findMany({where:{createdByText:actor},include:{revisions:true}}); docs.push(...imported.map(d=>d.id));
        assert.equal(imported.length,6); assert.equal((await getBatch(id)).state,"PARTIAL");
        for (const d of imported) { assert.equal(d.verificationStatus,"UNVERIFIED"); assert.equal(d.administrativeStatus,"DRAFT"); for (const r of d.revisions) { assert.equal(r.status,"IMPORTED_PENDING"); assert.equal(r.verificationStatus,"UNVERIFIED"); assert.equal(r.consolidatedAt,null); assert.equal(r.verifiedAt,null); assert.equal(r.verifiedByText,null); assert.equal(r.previousRevisionId,null); } }
        const original = imported.find(d=>d.baseCode === "GC-00/002")!; assert.equal(original.revisions[0].revisionCode,"00");
        assert.equal(imported.find(d=>d.baseCode === "GC-00/003")!.revisions.length,0);
        assert.equal((imported.find(d=>d.baseCode === "GC-00/003")!.sourceMetadata as {indexImport:{declaredState:string}}).indexImport.declaredState,"ANNULLED");
        assert.equal((imported.find(d=>d.baseCode === "GC-00/004")!.revisions[0].sourceMetadata as {indexImport:{declaredState:string}}).indexImport.declaredState,"IN_PREPARATION");
        assert.equal(imported.find(d=>d.baseCode === "GC-00/004")!.revisions[0].effectiveFrom,null);
        assert.equal(imported.find(d=>d.baseCode === "MC-20/001")!.revisions[0].revisionCode,"01");
        assert.equal((await prisma.department.findUniqueOrThrow({where:{id:sg.id}})).isActive,false);
        const edit = new FormData(); for (const [key,value] of Object.entries({baseCode:"GC-00/998",title:original.title!,departmentId:gc.id,actor,operation:"EDIT",updatedAt:original.updatedAt.toISOString(),changeReason:"Intento de cambiar identidad importada QA"})) edit.set(key,value);
        await assert.rejects(saveMaster(parseMasterForm(edit),original.id),/importado es permanente/);
        const beforeRetry = await businessSnapshot(); assert.equal((await confirm(id,input)).retried,true); assert.equal(await businessSnapshot(),beforeRetry);
        const completed = await getBatch(id); assert.equal(completed.events.filter(e=>e.action === "CONFIRMED").length,1); assert.ok(completed.events.some(e=>e.action === "ERROR")); assert.equal((completed.rows.find(r=>r.baseCode === "GC-00/002")!.data as unknown as PreviewRow).source.values.length,0);
        // Reimport same bytes: omit, do not mutate any master/revision/history or verification.
        const repeat = await batch(); await include(repeat,"GC-00/001",gc.id); await include(repeat,"GC-00/002",gc.id);
        const repeatedPlan = await prepare(repeat); assert.equal(repeatedPlan.summary.existing,2); assert.equal(repeatedPlan.summary.businessWrites,0); await confirm(repeat,await request(repeat)); assert.equal(await businessSnapshot(),beforeRetry);
        // A second explicit revision is permitted without creating another DRAFT or declaring it IN_FORCE.
        const bytes = syntheticWorkbook([{name:"GC-00(",rows:[{number:1,cells:headings},{number:2,cells:{B:"GC-00/001",C:"Procedimiento ficticio",D:4,E:"13/04/2026",F:"13/04/2031"}}]}]);
        const next = await batch(bytes); await include(next,"GC-00/001",gc.id); assert.equal((await prepare(next)).summary.newRevisions,1); await confirm(next,await request(next));
        const first = imported.find(d=>d.baseCode === "GC-00/001")!; assert.deepEqual(await prisma.controlledDocumentRevision.findUnique({where:{id:first.revisions[0].id}}),first.revisions[0]);
        // Changes after reconciliation, and changes after preparation, both require new review.
        const stale = await batch(); await include(stale,"GC-00/002",gc.id); const staleInput = await request(stale);
        await prisma.controlledDocument.update({where:{id:original.id},data:{observations:"Cambio QA posterior"}});
        await assert.rejects(confirm(stale,staleInput),/BD ha cambiado/); const stalePlan = await prepare(stale); assert.equal(stalePlan.summary.conflicts,2); assert.equal(stalePlan.proposals.find(p=>p.baseCode === "GC-00/002")!.kind,"CONFLICT");
        await include(stale,"GC-00/002",gc.id); assert.equal((await prepare(stale)).summary.existing,1);
        // Verified/consolidated history survives omission and conflicts byte-for-byte.
        const verified = await prisma.controlledDocument.create({data:{baseCode:"GC-00/950",title:"Histórico acreditado QA",departmentId:gc.id,departmentCodeSnapshot:gc.code,departmentNameSnapshot:gc.name,administrativeStatus:"ACTIVE",verificationStatus:"VERIFIED",createdByText:actor,revisions:{create:{revisionCode:"00",baseCodeSnapshot:"GC-00/950",titleSnapshot:"Histórico acreditado QA",departmentCodeSnapshot:gc.code,departmentNameSnapshot:gc.name,status:"IN_FORCE",verificationStatus:"VERIFIED",verifiedByText:actor,verifiedAt:new Date(),consolidatedAt:new Date(),effectiveFrom:new Date("2026-01-01"),reviewDueAt:new Date("2031-01-01"),registeredByText:actor}}},include:{revisions:true}}); docs.push(verified.id);
        const historyBytes = syntheticWorkbook([{name:"GC-00(",rows:[{number:1,cells:headings},{number:2,cells:{B:"GC-00/950",C:"Histórico acreditado QA",D:0,E:"01/01/2026",F:"01/01/2031"}}]}]);
        const historical = await batch(historyBytes); await include(historical,"GC-00/950",gc.id); await confirm(historical,await request(historical)); assert.deepEqual(await prisma.controlledDocument.findUnique({where:{id:verified.id},include:{revisions:true}}),verified);
        const conflict = await batch(historyBytes); await include(conflict,"GC-00/950",gc.id,{title:"Título distinto"}); assert.equal((await prepare(conflict)).summary.conflicts,1); assert.ok((await getBatch(conflict)).events.some(e=>e.action === "PROPOSED")); await assert.rejects(confirm(conflict,await request(conflict)),/elegibles/); assert.deepEqual(await prisma.controlledDocument.findUnique({where:{id:verified.id},include:{revisions:true}}),verified);
        // SQL-trigger fault after an earlier business insert demonstrates transaction-wide rollback.
        const rollbackBytes = syntheticWorkbook([{name:"GC-00(",rows:[{number:1,cells:headings},...['960','961'].map((code,i)=>({number:i+2,cells:{B:`GC-00/${code}`,C:"Rollback QA",D:0}}))]}]);
        const rollback = await batch(rollbackBytes); await include(rollback,"GC-00/960",gc.id); await include(rollback,"GC-00/961",gc.id);
        await prisma.$executeRawUnsafe(`CREATE FUNCTION p1b2_qa_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."baseCode" IN ('GC-00/960','GC-00/961') AND EXISTS (SELECT 1 FROM "ControlledDocument" WHERE "baseCode" IN ('GC-00/960','GC-00/961')) THEN RAISE EXCEPTION 'Synthetic transaction fault'; END IF; RETURN NEW; END $$`);
        await prisma.$executeRawUnsafe(`CREATE TRIGGER p1b2_qa_fault BEFORE INSERT ON "ControlledDocument" FOR EACH ROW EXECUTE FUNCTION p1b2_qa_fault()`);
        const snap = await businessSnapshot(); try { await assert.rejects(confirm(rollback,await request(rollback))); assert.equal(await businessSnapshot(),snap); assert.equal((await getBatch(rollback)).rows.some(r=>r.result),false); } finally { await prisma.$executeRawUnsafe('DROP TRIGGER p1b2_qa_fault ON "ControlledDocument"'); await prisma.$executeRawUnsafe('DROP FUNCTION p1b2_qa_fault()'); }
        await confirm(rollback,await request(rollback)); docs.push(...(await prisma.controlledDocument.findMany({where:{baseCode:{in:["GC-00/960","GC-00/961"]}},select:{id:true}})).map(d=>d.id));
        // Two batches concurrently confirm the same identity: one insert, the other needs review/omits on retry.
        const concurrentBytes = syntheticWorkbook([{name:"GC-00(",rows:[{number:1,cells:headings},{number:2,cells:{B:"GC-00/970",C:"Concurrente QA",D:0}}]}]);
        const a = await batch(concurrentBytes), c = await batch(concurrentBytes); await include(a,"GC-00/970",gc.id); await include(c,"GC-00/970",gc.id);
        const [ai,ci] = await Promise.all([request(a),request(c)]); const results = await Promise.allSettled([confirm(a,ai),confirm(c,ci)]); assert.equal(results.filter(r=>r.status === "fulfilled").length,1);
        const concurrentDocs = await prisma.controlledDocument.findMany({where:{baseCode:"GC-00/970"},include:{revisions:true}}); assert.equal(concurrentDocs.length,1); assert.equal(concurrentDocs[0].revisions.length,1); docs.push(concurrentDocs[0].id);
        const failedId = results[0].status === "rejected" ? a : c; await include(failedId,"GC-00/970",gc.id); assert.equal((await prepare(failedId)).summary.existing,1); await confirm(failedId,await request(failedId));
        // Concurrent identical request then retry must return one confirmed receipt.
        const same = await batch(concurrentBytes); await include(same,"GC-00/970",gc.id); const si = await request(same); await Promise.allSettled([confirm(same,si),confirm(same,si)]); assert.equal((await confirm(same,si)).retried,true); assert.equal((await getBatch(same)).events.filter(e=>e.action === "CONFIRMED").length,1);
        // Whole-group pending/excluded decisions and expired pending-data purge.
        const excluded = await batch(); const xb = await getBatch(excluded), xr = xb.rows.find(r=>r.baseCode === "MC-20/001")!;
        for (const decision of ["PENDING","EXCLUDED"] as const) { const current = await getBatch(excluded); await decide(excluded,{actor,sourceKey:xr.sourceKey,version:current.version,decision,scope:"GROUP",reason:"Decisión manual de grupo QA"}); assert.equal((await getBatch(excluded)).rows.filter(r=>r.baseCode === "MC-20/001" && r.decision === decision).length,2); }
        await prisma.controlledDocumentImportBatch.update({where:{id:excluded},data:{expiresAt:new Date(0)}}); await expireBatches(); const expired = await getBatch(excluded); assert.equal(expired.state,"EXPIRED"); assert.equal(expired.rows.length,0); assert.ok(expired.events.some(e=>e.action === "EXPIRED"));
        if (process.env.P1B2_PRIVATE_XLSX_PATH) { const before = await businessSnapshot(); const real = await previewIndex(readFileSync(process.env.P1B2_PRIVATE_XLSX_PATH),"ÍNDICE GENERAL 2025.xlsx"); assert.equal(real.summary.pntCandidates,821); assert.equal(real.summary.uniqueCodes,817); assert.equal(real.summary.otherDocuments,970); assert.equal(real.rows.some(r=>r.source.sheet === "GC-00"),false); assert.equal(await businessSnapshot(),before); console.log("Libro real QA privado: 39 hojas, 821 apariciones, 817 códigos, 970 otras familias; sin confirmación ni escrituras operativas."); }
        console.log("P1B-2 PostgreSQL OK: exclusión GC-00; grupos manuales, inactivos/desconocidos, 00/vacíos, estados separados, parcial, histórico inmutable, reimportación, reintento, rollback SQL, concurrencia, resultados y retención.");
    } finally {
        // Only UUID fixtures created by this smoke are removed in isolated QA.
        const created = await prisma.controlledDocument.findMany({where:{createdByText:actor},select:{id:true}}); const ids = [...new Set([...docs,...created.map(d=>d.id)])];
        await prisma.controlledDocumentChange.deleteMany({where:{documentId:{in:ids}}}); await prisma.controlledDocumentRevision.deleteMany({where:{documentId:{in:ids}}}); await prisma.controlledDocument.deleteMany({where:{id:{in:ids}}});
        await prisma.controlledDocumentImportEvent.deleteMany({where:{batchId:{in:batches}}}); await prisma.controlledDocumentImportRow.deleteMany({where:{batchId:{in:batches}}}); await prisma.controlledDocumentImportBatch.deleteMany({where:{id:{in:batches}}}); await prisma.department.delete({where:{id:sg.id}});
    }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
