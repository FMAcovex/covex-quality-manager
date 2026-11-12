import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/db";
import { addPlanEntry, createAnnualPlan, retirePlanEntry, updatePlanEntry } from "../src/modules/audits/plans";
import { getAnnualProgrammeFile, getProgrammePreview, issueAnnualProgramme, saveProgrammeApprovers } from "../src/modules/audits/annual-programme/service";
import { programmeDocumentTypes } from "../src/modules/audits/annual-programme/domain";
import { syntheticAnnexVProgramme, syntheticAnnualProgramme } from "./audits-annual-programme-fixtures";
import { readZip, getZipEntryText } from "../src/lib/ooxml/zip";
const actor = "QA programa ficticio";
async function main() {
  if (process.env.APP_ENV !== "test") throw Error("Smoke de programas anuales solo en APP_ENV=test con PostgreSQL aislado.");
  const suffix = randomUUID().slice(0, 8);
  for (const internal of [true, false]) {
    const type = internal ? "INTERNAL" : "EXTERNAL";
    const source = syntheticAnnualProgramme(internal);
    if (process.env.ANNUAL_OFFICIAL_TEMPLATES !== "1") await prisma.templateVersion.create({ data: { module: "AUDIT", documentType: programmeDocumentTypes[type], versionCode: `QA-${suffix}`, effectiveFrom: new Date("2026-10-09"), fileName: "ficticia.docx", fileData: new Uint8Array(source), fileSize: source.length, checksum: createHash("sha256").update(source).digest("hex") } });
    const occupied = await prisma.auditAnnualPlan.findMany({ where: { auditType: type }, select: { year: true } });
    const year = Array.from({ length: 101 }, (_, i) => 2100 - i).find(y => !occupied.some(p => p.year === y))!;
    const plan = await createAnnualPlan({ year, auditType: type, title: `Programa QA ${suffix}`, notes: "Datos ficticios", actor });
    const entryInput = { subject: "Objeto ficticio", targetName: "Entidad QA ficticia", departmentId: "", plannedDate: "", plannedPeriodText: "Primer trimestre", plannedAuditorsText: "Auditor QA", productService: "Servicio ficticio", plannedScope: "Alcance ficticio", plannedModality: "REMOTE", programmeArea: "Calidad", notes: "Notas de planificación", actor, reason: "Cambio QA" };
    const { entry } = await addPlanEntry(plan.id, entryInput);
    const missing = await getProgrammePreview(plan.id); assert(missing.blockers.length > 0);
    await saveProgrammeApprovers(plan.id, { technicalApproverName: "Técnico QA ficticio", qualityApproverName: "Calidad QA ficticia", actor, reason: "Completar aprobación" });
    const preview = await getProgrammePreview(plan.id); assert.equal(preview.blockers.length, 0);
    const input = { actor, reason: "", requestId: randomUUID(), expectedFingerprint: preview.fingerprint };
    const first = await issueAnnualProgramme(plan.id, input); assert.equal(first.sequenceNumber, 0);
    const repeat = await issueAnnualProgramme(plan.id, input); assert.equal(repeat.id, first.id);
    await assert.rejects(issueAnnualProgramme(plan.id, { ...input, actor: "Otro" }), /utilizada/);
    await assert.rejects(issueAnnualProgramme(plan.id, { ...input, requestId: randomUUID() }), /motivo/);
    const download = await getAnnualProgrammeFile(plan.id, first.id); assert.deepEqual(download.fileData, first.fileData);
    await assert.rejects(getAnnualProgrammeFile(randomUUID(), first.id), /encontrada/);
    await assert.rejects(prisma.auditAnnualProgrammeVersion.update({ where: { id: first.id }, data: { reason: "No permitido" } }));
    await assert.rejects(prisma.auditAnnualProgrammeVersion.delete({ where: { id: first.id } }));
    const linked = await prisma.qmsRecord.create({ data: { recordType: "AUDIT" } });
    await prisma.audit.create({ data: { qmsRecordId: linked.id, auditType: type, scenario: internal ? "INTERNAL_COVEX" : "SUPPLIER", status: "OPEN", planningStatus: "PLANNED", planEntryId: entry.id, performedDate: new Date("2026-10-07"), capaPlanEstablishedAt: new Date("2026-10-08"), reportSentAt: new Date("2026-10-09"), closedAt: new Date("2026-10-10") } });
    await assert.rejects(issueAnnualProgramme(plan.id, { ...input, requestId: randomUUID(), reason: "Vista obsoleta" }), /cambiado/);
    const execution = await getProgrammePreview(plan.id);
    assert.equal(execution.content.rows[0].performed, "07/10/2026");
    // D-135 (R6): el cierre parcial es el CAPA plan 00 establecido también en externas (no el envío del informe).
    assert.equal(execution.content.rows[0].partial, "08/10/2026");
    const next = await Promise.all([1, 2].map(i => issueAnnualProgramme(plan.id, { actor, reason: `Concurrente ${i}`, requestId: randomUUID(), expectedFingerprint: execution.fingerprint })));
    assert.deepEqual(next.map(v => v.sequenceNumber).sort(), [1, 2]);
    const sameKey = { actor, reason: "Doble envío", requestId: randomUUID(), expectedFingerprint: execution.fingerprint };
    const same = await Promise.all([issueAnnualProgramme(plan.id, sameKey), issueAnnualProgramme(plan.id, sameKey)]); assert.equal(same[0].id, same[1].id);
    await updatePlanEntry(plan.id, entry.id, { ...entryInput, notes: "Cambio posterior documentado" });
    assert.deepEqual((await getAnnualProgrammeFile(plan.id, first.id)).fileData, first.fileData);
    assert.equal((first.snapshot as { content: { rows: { notes: string }[] } }).content.rows[0].notes, "Notas de planificación");
    const audit = await prisma.audit.findUniqueOrThrow({ where: { planEntryId: entry.id } });
    const outsideRecord = await prisma.qmsRecord.create({ data: { recordType: "AUDIT" } });
    await prisma.audit.create({ data: { qmsRecordId: outsideRecord.id, auditType: type, scenario: internal ? "INTERNAL_COVEX" : "SUPPLIER", planningStatus: "OUT_OF_PLAN", outsidePlanReason: "Auditoría extraordinaria QA", title: "FUERA DE PLAN QA" } });
    assert.equal((await getProgrammePreview(plan.id)).content.rows.length, 1);
    await prisma.qmsRecord.update({ where: { id: linked.id }, data: { isActive: false } });
    assert.equal((await getProgrammePreview(plan.id)).content.rows[0].performed, "");
    await prisma.qmsRecord.update({ where: { id: linked.id }, data: { isActive: true } });
    await prisma.audit.update({ where: { id: audit.id }, data: { status: "DRAFT" } });
    assert.equal((await getProgrammePreview(plan.id)).content.rows[0].partial, "");
    await prisma.audit.update({ where: { id: audit.id }, data: { status: "OPEN" } });
    const template = await prisma.templateVersion.findUniqueOrThrow({ where: { id: first.templateVersionId } });
    await prisma.templateVersion.update({ where: { id: template.id }, data: { checksum: "0".repeat(64) } });
    const corrupt = await getProgrammePreview(plan.id);
    await assert.rejects(issueAnnualProgramme(plan.id, { actor, reason: "Plantilla corrupta", requestId: randomUUID(), expectedFingerprint: corrupt.fingerprint }), /checksum/);
    await prisma.templateVersion.update({ where: { id: template.id }, data: { checksum: template.checksum } });
    const xml = getZipEntryText(readZip(Buffer.from(next[0].fileData)), "word/document.xml"); assert(xml.includes("Entidad QA ficticia"));
    if (process.env.ANNUAL_QA_OUTPUT) { await mkdir(process.env.ANNUAL_QA_OUTPUT, { recursive: true }); await writeFile(`${process.env.ANNUAL_QA_OUTPUT}/${type}-00.docx`, first.fileData); await writeFile(`${process.env.ANNUAL_QA_OUTPUT}/${type}-01.docx`, next[0].fileData); }
    console.log(`OK ${type}: emisión, ejecución, integridad, histórico, idempotencia, concurrencia, separación fuera de plan. Plan ${plan.id}`);
  }
  if (process.env.ANNUAL_OFFICIAL_TEMPLATES !== "1") for (const internal of [true, false]) await annexV(internal, suffix);
}
const cellsOf = (xml: string, table: number) => {
  const tbl = [...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)][table][0];
  return [...tbl.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map(r => [...r[0].matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)].map(c => [...c[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join("")));
};
/** D-135 (R6): Anexo V con plantilla ficticia; versiones manuales, aplazada y cancelada con motivo, código y cierre parcial. */
async function annexV(internal: boolean, suffix: string) {
  const type = internal ? "INTERNAL" : "EXTERNAL", source = syntheticAnnexVProgramme(internal);
  const used = new Set((await prisma.templateVersion.findMany({ where: { module: "AUDIT", documentType: programmeDocumentTypes[type] }, select: { versionCode: true } })).map(t => t.versionCode));
  const code = Array.from({ length: 90 }, (_, i) => `GC-${10 + i}-0${internal ? 33 : 34}-04-ANEXO-V`).find(c => !used.has(c))!;
  const template = await prisma.templateVersion.create({ data: { module: "AUDIT", documentType: programmeDocumentTypes[type], versionCode: code, effectiveFrom: new Date("2026-10-10"), fileName: "anexo-v-ficticio.docx", fileData: new Uint8Array(source), fileSize: source.length, checksum: createHash("sha256").update(source).digest("hex") } });
  try {
    const occupied = await prisma.auditAnnualPlan.findMany({ where: { auditType: type }, select: { year: true } });
    const year = Array.from({ length: 101 }, (_, i) => 2100 - i).find(y => !occupied.some(p => p.year === y))!;
    const plan = await createAnnualPlan({ year, auditType: type, title: `Anexo V QA ${suffix}`, notes: "Datos ficticios", actor });
    const base = { departmentId: "", plannedPeriodText: "", plannedAuditorsText: "Auditor QA", productService: "Servicio ficticio", plannedScope: "Alcance ficticio", plannedModality: "ONSITE", programmeArea: "Calidad", notes: "", actor, reason: "" };
    const a = (await addPlanEntry(plan.id, { ...base, subject: "Auditoría A", targetName: "Área A ficticia", plannedDate: `${year}-03-15` })).entry;
    const b = (await addPlanEntry(plan.id, { ...base, subject: "Auditoría B", targetName: "Área B ficticia", plannedDate: `${year}-05-15` })).entry;
    await saveProgrammeApprovers(plan.id, { technicalApproverName: "Técnico anterior", qualityApproverName: "Directora GC ficticia", actor, reason: "Datos de partida" });
    let preview = await getProgrammePreview(plan.id);
    assert.equal(preview.content.format, "ANNEX_V");
    assert.equal(preview.content.reference, `Anexo V del PNT ${code.replace(/^GC-(\d{2})-(\d{3})-(\d{2})-ANEXO-V$/, "GC-$1/$2/$3")}`);
    assert(preview.blockers.some(x => /quién elabora/.test(x)), "El Anexo V exige quién elabora");
    // El formulario del Anexo V no envía el aprobador técnico: se conserva el anterior.
    await saveProgrammeApprovers(plan.id, { preparedByName: "Técnica GC ficticia", qualityApproverName: "Directora GC ficticia", actor, reason: "Elaborado por" });
    assert.equal((await prisma.auditAnnualPlan.findUniqueOrThrow({ where: { id: plan.id } })).technicalApproverName, internal ? "Técnico anterior" : null);
    preview = await getProgrammePreview(plan.id); assert.deepEqual(preview.blockers, []); assert.deepEqual(preview.changes, []);
    const v0 = await issueAnnualProgramme(plan.id, { actor, reason: "", requestId: randomUUID(), expectedFingerprint: preview.fingerprint });
    const xml0 = getZipEntryText(readZip(Buffer.from(v0.fileData)), "word/document.xml");
    assert.deepEqual(cellsOf(xml0, 1)[0], ["Año:", String(year), "Versión:", "00"]);
    assert(xml0.includes("Técnica GC ficticia") && !xml0.includes("Técnico anterior"));
    // Una entrada retirada antes de publicarse no aparece; una publicada y retirada sigue como cancelada.
    const c = (await addPlanEntry(plan.id, { ...base, subject: "Auditoría C", targetName: "Área C ficticia", plannedDate: `${year}-06-15` })).entry;
    await retirePlanEntry(plan.id, c.id, actor, "Duplicada");
    await updatePlanEntry(plan.id, a.id, { ...base, subject: "Auditoría A", targetName: "Área A ficticia", plannedDate: `${year}-04-20`, reason: "Falta de disponibilidad del área" });
    await retirePlanEntry(plan.id, b.id, actor, "Proceso externalizado");
    const record = await prisma.qmsRecord.create({ data: { recordType: "AUDIT", businessCode: `QA-ANEXO-V/${suffix}/${type}`, year } });
    await prisma.audit.create({ data: { qmsRecordId: record.id, auditType: type, scenario: internal ? "INTERNAL_COVEX" : "SUPPLIER", status: "OPEN", planningStatus: "PLANNED", planEntryId: a.id, performedDate: new Date(`${year}-04-21`), capaPlanEstablishedAt: new Date(`${year}-05-30`) } });
    preview = await getProgrammePreview(plan.id);
    const [rowA, rowB] = preview.content.rows;
    assert.equal(preview.content.rows.length, 2);
    assert.deepEqual([rowA.code, rowA.performed, rowA.partial], [`QA-ANEXO-V/${suffix}/${type}`, `21/04/${year}`, `30/05/${year}`]);
    assert(rowA.comments.startsWith(`Aplazada (prevista inicialmente: 15/03/${year}). Motivo: Falta de disponibilidad del área`), rowA.comments);
    assert.equal(internal, !rowA.comments.includes("Modalidad prevista: Presencial"));
    assert(rowB.cancelled && rowB.comments.startsWith("Cancelada. Motivo: Proceso externalizado"), rowB.comments);
    assert(preview.changes.includes("Cancelada: Área B ficticia."), preview.changes.join(" | "));
    assert(preview.changes.some(x => x.startsWith("Área A ficticia: código de auditoría vacío →")), preview.changes.join(" | "));
    const v1 = await issueAnnualProgramme(plan.id, { actor, reason: "Actualización del primer semestre", requestId: randomUUID(), expectedFingerprint: preview.fingerprint });
    const rows1 = cellsOf(getZipEntryText(readZip(Buffer.from(v1.fileData)), "word/document.xml"), 2);
    assert.deepEqual(cellsOf(getZipEntryText(readZip(Buffer.from(v1.fileData)), "word/document.xml"), 1)[0], ["Año:", String(year), "Versión:", "01"]);
    const dataRows = rows1.filter(r => r.length === 8 && /^\d+$/.test(r[0]));
    assert.deepEqual(dataRows.map(r => r[4]), [`QA-ANEXO-V/${suffix}/${type}`, ""]);
    assert(dataRows[1][7].startsWith("Cancelada. Motivo: Proceso externalizado"));
    assert(!JSON.stringify(rows1).includes("Área C ficticia"));
    assert.deepEqual((await getProgrammePreview(plan.id)).changes, []);
    console.log(`OK Anexo V ${type}: versiones 00/01, elaborado/aprobado, aplazada y cancelada con motivo, código y cierre parcial. Plan ${plan.id}`);
  } finally {
    // La plantilla ficticia no debe quedar vigente para otras ejecuciones.
    await prisma.templateVersion.update({ where: { id: template.id }, data: { isActive: false } });
  }
}
main().finally(() => prisma.$disconnect()).catch(e => { console.error(e); process.exitCode = 1; });
