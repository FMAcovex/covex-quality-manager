import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { PrismaClient, Prisma } from "@prisma/client";
import { isolatedTestEnvironment } from "../src/lib/auth/config";
import { fixtureUsers } from "./auth-fixtures/constants";
import { fixtureLogin, cookieHeader } from "./auth-fixtures/http";
import { writeZip, readZip } from "../src/lib/ooxml/zip";
import { auditApplicationFixture, auditedSqlFixture, businessApplicationGrantsFixture, businessSqlFixture } from "./audit-fixtures/database";

const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
function officeFixture(kind: "word" | "sheet") {
  const main = kind === "word" ? "word/document.xml" : "xl/workbook.xml";
  const mime = kind === "word" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
  const entries = [
    { name: "[Content_Types].xml", data: Buffer.from(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/${main}" ContentType="${mime}"/>${kind === "sheet" ? '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' : ""}</Types>`) },
    { name: "_rels/.rels", data: Buffer.from(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${main}"/></Relationships>`) },
    { name: main, data: Buffer.from(kind === "word" ? '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Documento totalmente ficticio de recuperacion 4B2</w:t></w:r></w:p></w:body></w:document>' : '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Ficticio" sheetId="1" r:id="rId1"/></sheets></workbook>') },
  ];
  if (kind === "sheet") entries.push({ name: "xl/_rels/workbook.xml.rels", data: Buffer.from('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>') }, { name: "xl/worksheets/sheet1.xml", data: Buffer.from('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Ficticio 4B2</t></is></c></row></sheetData></worksheet>') });
  const bytes = writeZip(entries);
  readZip(bytes, { maxExpandedBytes: 100000, verifyIntegrity: true });
  return Buffer.from(bytes);
}
function command(binary: string, args: string[], env = process.env) {
  const result = spawnSync(binary, args, { env, encoding: "utf8", timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Synthetic operation failed: ${binary} (${result.status}); ${result.stdout?.slice(-1800) ?? ""}`);
  return result.stdout.trim();
}
async function ready(url: string, child: ChildProcess) {
  for (let i = 0; i < 60; i++) {
    assert.equal(child.exitCode, null, "Servicio sintético sigue activo");
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1500) }); if (response.ok) return; } catch { /* local readiness only */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error("Synthetic service readiness failed");
}
async function stop(child?: ChildProcess) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise<void>(r => { child.once("exit", () => r()); setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); r(); }, 5000).unref(); });
}

async function main() {
  assert(isolatedTestEnvironment(), "Solo entorno PostgreSQL/OIDC sintético aislado");
  const base = new URL(process.env.DATABASE_URL!), id = randomBytes(8).toString("hex"), sourceName = "covex_phase4b1_test_4b2_source_" + id;
  const targetName = "covex_phase4b1_test_4b2_restore_" + id, failedName = "covex_phase4b1_test_4b2_restore_" + randomBytes(8).toString("hex");
  assert(["localhost", "127.0.0.1"].includes(base.hostname));
  const parent = new PrismaClient(), sourceUrl = new URL(base);
  sourceUrl.pathname = "/" + sourceName;
  const source = new PrismaClient({ datasourceUrl: sourceUrl.href });
  const root = mkdtempSync(join(tmpdir(), "covex4b2-")), assetRoot = join(root, "templates"), keys = ["encryption.key", "manifest.key"];
  const env = { ...process.env, DATABASE_URL: sourceUrl.href, AUTH_ORIGIN: "http://127.0.0.1:3102", AUTH_TEST_ISSUER: "http://127.0.0.1:5462" };
  let restored: PrismaClient | undefined, app: ChildProcess | undefined, provider: ChildProcess | undefined;
  let auditSourceApp: PrismaClient | undefined, auditRestoredApp: PrismaClient | undefined;
  const auditRoles: string[] = [];
  let pgContainer: string | undefined, pgPassPath: string | undefined;
  const role = "covex4b2_backup_" + id, roleSecret = randomBytes(32).toString("hex");
  const databases: string[] = [];
  try {
    await parent.$executeRawUnsafe(`CREATE DATABASE "${sourceName}" TEMPLATE template0`); databases.push(sourceName);
    command("pnpm", ["db:deploy"], env); command("pnpm", ["db:seed"], env); command("pnpm", ["auth:fixtures"], env);
    // Seed has template location metadata, not fixture bytes. No GMP originals are read.
    await source.templateVersion.updateMany({ data: { filePath: null } });
    mkdirSync(assetRoot, { mode: 0o700 }); mkdirSync(join(root, "plain"), { mode: 0o700 });
    const word = officeFixture("word"), sheet = officeFixture("sheet"), asset = word;
    writeFileSync(join(assetRoot, "fixture.docx"), asset, { mode: 0o600 });
    for (const key of keys) writeFileSync(join(root, key), randomBytes(32).toString("hex"), { mode: 0o600 });
    const passfile = join(root, "test.pgpass");
    writeFileSync(passfile, `*:*:*:${decodeURIComponent(base.username)}:${decodeURIComponent(base.password)}\n*:*:*:${role}:${roleSecret}\n`, { mode: 0o600 });
    const department = await source.department.findFirstOrThrow({ orderBy: { code: "asc" } });
    const common = (type: "DEVIATION" | "CAPA" | "CHANGE_CONTROL" | "COMPLAINT" | "RETURN") => ({ department: { connect: { id: department.id } }, qmsRecord: { create: { recordType: type, businessCode: "4B2-" + type + "-" + id, year: 2026 } } });
    const deviation = await source.deviation.create({ data: { ...common("DEVIATION"), status: "OPEN", whatHappened: "Evento totalmente ficticio", createdByText: "Autor histórico sintético" } });
    const capa = await source.capa.create({ data: { ...common("CAPA"), status: "OPEN", actionType: "CORRECTIVE", defectDescription: "Defecto ficticio" } });
    await source.changeControl.create({ data: { ...common("CHANGE_CONTROL"), finalStatus: "OPEN", description: "Cambio ficticio" } });
    const complaint = await source.complaint.create({ data: { ...common("COMPLAINT"), status: "OPEN", complaintType: "CUSTOMER", description: "Reclamación ficticia" } });
    const returned = await source.returnRecord.create({ data: { ...common("RETURN"), status: "OPEN", returnType: "COMMERCIAL" } });
    await source.audit.create({ data: { title: "Auditoría ficticia", status: "OPEN", auditType: "INTERNAL", scenario: "INTERNAL_COVEX", createdByText: "Auditor sintético", codingDepartment: { connect: { id: department.id } }, qmsRecord: { create: { recordType: "AUDIT", businessCode: "4B2-AUDIT-" + id, year: 2026 } }, departments: { create: { departmentId: department.id, departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name } } } });
    await source.qmsRelation.createMany({ data: [{ sourceRecordId: deviation.qmsRecordId!, targetRecordId: capa.qmsRecordId!, relationType: "GENERATES" }, { sourceRecordId: complaint.qmsRecordId!, targetRecordId: returned.qmsRecordId!, relationType: "GENERATES" }] });
    const records = await source.qmsRecord.findMany({ orderBy: { id: "asc" } });
    for (const record of records) for (let sequence = 0; sequence < 2; sequence++) await source.qmsRecordVersion.create({ data: { qmsRecordId: record.id, sequenceNumber: sequence, kind: sequence ? "HISTORICAL_STATE" : "INITIAL", snapshot: { fictitious: true, sequence, historicalAuthor: "Nombre histórico externo" }, frozenAt: new Date(), createdByText: "Autor histórico sintético" } });
    const version = await source.qmsRecordVersion.findFirstOrThrow({ where: { qmsRecordId: deviation.qmsRecordId! } });
    await source.changeHistory.create({ data: { qmsRecordId: deviation.qmsRecordId!, changedByText: "Autor histórico sintético", fieldPath: "whatHappened", oldValue: "Anterior", newValue: "Ficticio", reason: "Evidencia sintética" } });
    const binary = Buffer.from("%PDF-1.4\nFictitious recovery evidence\x00\xff\n%%EOF", "latin1"), checksum = sha256(binary);
    const template = await source.templateVersion.create({ data: { module: "AUDIT", documentType: "AUDIT_ANNUAL_INTERNAL_PROGRAMME", versionCode: "4B2-" + id, effectiveFrom: new Date("2026-01-01"), fileData: word, fileName: "synthetic.docx", fileSize: word.length, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", checksum: sha256(word) } });
    await source.templateVersion.create({ data: { module: "DEVIATION", documentType: "DEVIATION_ANNEX_III", versionCode: "4B2-file-" + id, effectiveFrom: new Date("2026-01-01"), filePath: "templates/fixture.docx", checksum: sha256(asset) } });
    await source.generatedDocument.create({ data: { qmsRecordId: deviation.qmsRecordId!, recordVersionId: version.id, documentType: "DEVIATION_ANNEX_III", fileData: word, checksum: sha256(word), fileName: "synthetic.docx" } });
    await source.recordVersionDocument.create({ data: { recordVersionId: version.id, kind: "SIGNED_PDF", fileName: "synthetic-signed.pdf", fileData: binary, fileSize: binary.length, checksum, uploadedByText: "Firmante externo ficticio" } });
    const master = await source.controlledDocument.create({ data: { baseCode: department.code + "/999", title: "PNT ficticio de restauración", departmentId: department.id, departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name, createdByText: "Autor sintético", revisions: { create: { revisionCode: "00", baseCodeSnapshot: department.code + "/999", titleSnapshot: "PNT ficticio de restauración", departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name, registeredByText: "Autor sintético" } } }, include: { revisions: true } });
    const objectId = randomUUID();
    await source.controlledRevisionDocument.create({ data: { id: objectId, documentId: master.id, revisionId: master.revisions[0].id, originalName: "synthetic.pdf", kind: "DOCUMENT_PDF", state: "RECORDED_UNVERIFIED", fileData: binary, mimeType: "application/pdf", sha256: checksum, sizeBytes: binary.length, storageReference: "postgres:" + objectId, incorporatedBy: "Autor sintético", identitySource: "CORPORATE_SESSION" } });
    const externalId = randomUUID();
    await source.controlledRevisionDocument.create({ data: { id: externalId, documentId: master.id, revisionId: master.revisions[0].id, originalName: "Referencia sin custodia", kind: "APPROVAL_EVIDENCE", state: "RECORDED_UNVERIFIED", storageReference: "external:" + externalId, externalReference: "https://example.invalid/synthetic-evidence", incorporatedBy: "Autor sintético", identitySource: "CORPORATE_SESSION" } });
    const plan = await source.auditAnnualPlan.create({ data: { year: 2026, auditType: "INTERNAL", title: "Programa ficticio", createdByText: "Autor sintético" } });
    await source.auditAnnualProgrammeVersion.create({ data: { planId: plan.id, sequenceNumber: 0, requestId: randomUUID(), requestHash: sha256(sheet), contentFingerprint: sha256(sheet), snapshot: { synthetic: true }, templateVersionId: template.id, templateChecksum: sha256(word), reference: "4B2-FICTITIOUS", generatedBy: "Autor sintético", reason: "Prueba", fileName: "synthetic.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileData: sheet, fileSize: sheet.length, checksum: sha256(sheet) } });
    const oldToken = randomBytes(32).toString("base64url");
    const auditRole = "covex4b3_recovery_" + id; auditRoles.push(auditRole);
    await source.auditPilotRecord.create({ data: { qmsRecordId: deviation.qmsRecordId! } });
    auditSourceApp = await auditApplicationFixture(source, new URL(sourceUrl), auditRole);
    const auditReceipt = await auditedSqlFixture(auditSourceApp, fixtureUsers.qa.id, [deviation.qmsRecordId!], randomUUID(), 7);
    await businessApplicationGrantsFixture(source, auditRole);
    await source.$executeRaw`SELECT covex_b2_require_policy('Synthetic recovery fixture; no corporate acceptance')`;
    const editRequest = randomUUID();
    await businessSqlFixture(auditSourceApp, fixtureUsers.qa.id, editRequest, "DV02", "DEVIATION", "EDIT", "Synthetic recovered persisted correction", async tx => {
      await tx.deviation.update({ where: { id: deviation.id }, data: { whatHappened: "B2 persisted recovered correction" } });
      await tx.deviationImmediateAction.create({ data: { deviationId: deviation.id, description: "B2 recovered child" } });
      await tx.changeHistory.create({ data: { qmsRecordId: deviation.qmsRecordId, changedByText: fixtureUsers.qa.name, fieldPath: "whatHappened", oldValue: "Evento totalmente ficticio", newValue: "B2 persisted recovered correction", reason: "Synthetic recovered persisted correction" } });
    });
    await businessSqlFixture(auditSourceApp, fixtureUsers.qa.id, randomUUID(), "PN01", "PNT", "EDIT", "Synthetic recovery PNT correction", async tx => {
      await tx.controlledDocument.update({ where: { id: master.id }, data: { observations: "B2 recovered PNT metadata" } });
      await tx.controlledDocumentChange.create({ data: { documentId: master.id, action: "Synthetic recovery", changedByText: fixtureUsers.qa.name, reason: "Synthetic recovery PNT correction" } });
    });
    const receivedBytes = [Buffer.from("%PDF-1.7\nB2 first received replacement\x00\xff\n%%EOF", "latin1"), Buffer.from("%PDF-1.7\nB2 second received replacement\x00\xff\n%%EOF", "latin1")];
    for (const bytes of receivedBytes) await businessSqlFixture(auditSourceApp, fixtureUsers.qa.id, randomUUID(), "DV08", "DEVIATION", "ATTACH_DOCUMENT", "Synthetic recovered signed supersession", async tx => {
      const old = await tx.recordVersionDocument.findUniqueOrThrow({ where: { recordVersionId_kind: { recordVersionId: version.id, kind: "SIGNED_PDF" } } });
      const [receipt] = await tx.$queryRaw<{ custody_id: string }[]>`SELECT * FROM covex_b2_retain_signed_original(${fixtureUsers.qa.id}::uuid,${fixtureUsers.qa.name},${version.id},'SIGNED_PDF',${bytes}::bytea,'b2-received.pdf',${old.checksum},'Synthetic recovered signed supersession',NULL)`;
      await tx.recordVersionDocument.update({ where: { id: old.id }, data: { custodyId: receipt.custody_id, fileName: "b2-received.pdf", fileData: bytes, fileSize: bytes.length, checksum: sha256(bytes), uploadedByText: fixtureUsers.qa.name } });
      await tx.changeHistory.create({ data: { qmsRecordId: deviation.qmsRecordId, changedByText: fixtureUsers.qa.name, fieldPath: "__signed_document__", oldValue: { checksum: old.checksum }, newValue: { checksum: sha256(bytes) }, reason: "Synthetic recovered signed supersession" } });
    });
    let stagingId = "";
    await businessSqlFixture(auditSourceApp, fixtureUsers.qa.id, randomUUID(), "PN06", "PNT", "IMPORT", null, async tx => {
      const staging = await tx.controlledDocumentImportBatch.create({ data: { fileName: "synthetic-recovery-staging.xlsx", sha256: "c".repeat(64), analyzedAt: new Date(), actor: fixtureUsers.qa.name, summary: { synthetic: true }, reportMetadata: { synthetic: true }, expiresAt: new Date(Date.now()-86400000) } });
      stagingId = staging.id;
      await tx.controlledDocumentImportRow.create({ data: { batchId: staging.id, sourceKey: "c".repeat(64), data: { synthetic: true } } });
    });
    const [expiry] = await auditSourceApp.$queryRaw<{ expired: number }[]>`SELECT covex_b2_expire_staging(${fixtureUsers.qa.id}::uuid) AS expired`;
    assert.equal(expiry.expired, 1);
    const auditGolden = {
      operations: await source.auditOperation.findMany({ orderBy: { id: "asc" } }),
      events: await source.auditEvent.findMany({ orderBy: { id: "asc" } }),
      targets: await source.auditOperationTarget.findMany({ orderBy: [{ rootKey: "asc" }, { aggregateSequence: "asc" }] }),
      cursors: await source.auditAggregateCursor.findMany({ orderBy: { rootKey: "asc" } }),
      receipts: await source.auditCommandResult.findMany({ orderBy: { operationId: "asc" } }),
      evidence: await source.auditOperationEvidence.findMany({ orderBy: { id: "asc" } }),
      additionalTargets: await source.auditEventAdditionalTarget.findMany({ orderBy: [{ eventId: "asc" }, { rootKey: "asc" }] }),
      custody: await source.signedDocumentCustody.findMany({ orderBy: { id: "asc" }, include: { originalDocument: true } }),
      slots: await source.recordVersionDocument.findMany({ orderBy: { id: "asc" } }),
      technical: await source.auditTechnicalEvent.findMany({ orderBy: { id: "asc" } }),
    };
    assert.equal(auditGolden.operations.filter(op => op.schemaVersion === 2).length, 5);
    assert.equal(auditGolden.receipts.length, 5); assert.equal(auditGolden.custody.length, 3); assert.equal(auditGolden.technical.length, 1);
    assert(auditGolden.events.some(event => event.entityType === "SignedDocumentCustody"));
    assert(auditGolden.evidence.length >= 3);
    await source.authSession.create({ data: { userId: fixtureUsers.qa.id, tokenHash: sha256(oldToken), csrfHash: sha256("synthetic-csrf"), expiresAt: new Date(Date.now() + 3600000) } });
    await source.authLoginAttempt.create({ data: { id: randomUUID(), state: "synthetic", nonce: "synthetic", verifier: "synthetic", returnTo: "/", expiresAt: new Date(Date.now() + 60000) } });
    // Least-privilege backup identity on this disposable database only.
    await parent.$executeRawUnsafe(`CREATE ROLE "${role}" LOGIN PASSWORD '${roleSecret}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
    await source.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`); await source.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${role}"`); await source.$executeRawUnsafe(`GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO "${role}"`);
    const roleUrl = new URL(sourceUrl); roleUrl.username = role; roleUrl.password = roleSecret;
    const restricted = new PrismaClient({ datasourceUrl: roleUrl.href });
    try { await restricted.$queryRaw`SELECT 1`; await assert.rejects(restricted.$executeRaw`CREATE TABLE forbidden_4b2 (id integer)`); await assert.rejects(restricted.$executeRaw`DELETE FROM "AuthUser"`); } finally { await restricted.$disconnect(); }
    const bins = join(root, "bin"); mkdirSync(bins);
    const native = spawnSync("pg_dump", ["--version"], { encoding: "utf8" });
    if (!native.stdout?.includes(" 16.")) {
      const container = process.env.PHASE4B2_TEST_POSTGRES_CONTAINER ?? command("docker", ["ps", "--filter", "ancestor=postgres:16-alpine", "--format", "{{.ID}}"], process.env).split("\n")[0];
      assert(/^[a-zA-Z0-9_.-]+$/.test(container), "Contenedor PostgreSQL16 sintético identificado");
      const insidePass = "/tmp/covex4b2-" + id + ".pgpass"; command("docker", ["cp", passfile, container + ":" + insidePass]);
      pgContainer = container; pgPassPath = insidePass;
      // Test-only adapter: preserve actual PG16 tools/snapshots, bridge local files/stdin.
      const adapter = `const fs=require('fs'),cp=require('child_process'),path=require('path');const tool=path.basename(process.argv[1]),args=process.argv.slice(2);let input,output;const file=args.find(a=>a.startsWith('--file='));if(file){output=file.slice(7);args.splice(args.indexOf(file),1);}if(tool==='pg_restore'&&args.length&&fs.existsSync(args[args.length-1]))input=args.pop();const flags=['PGDATABASE','PGUSER','PGOPTIONS','PGSSLMODE','PGCONNECT_TIMEOUT'].flatMap(k=>['-e',k]);const port=process.env.PGPORT==='${base.port || "5432"}'?'5432':process.env.PGPORT;const child=cp.spawn('docker',['exec','-i',...flags,'-e','PGHOST=127.0.0.1','-e','PGPORT='+port,'-e','PGPASSFILE=${insidePass}','${container}',tool,...args]);(input?fs.createReadStream(input):process.stdin).pipe(child.stdin);child.stdout.pipe(output?fs.createWriteStream(output,{mode:0o600}):process.stdout);child.stderr.pipe(process.stderr);child.on('close',code=>{process.exitCode=code??1;});`;
      for (const tool of ["psql", "pg_dump", "pg_restore"]) { const file = join(bins, tool); writeFileSync(file, "#!/usr/bin/env node\n" + adapter, { mode: 0o700 }); chmodSync(file, 0o700); }
    }
    const pgEnv = { ...env, PATH: bins + ":" + process.env.PATH };
    // Explicitly enroll disposable storage; production cannot use this test mode.
    const storageRoot = join(root, "storage"), marker = randomBytes(64);
    mkdirSync(storageRoot, { mode: 0o700 }); mkdirSync(join(storageRoot, "backups"), { mode: 0o700 });
    writeFileSync(join(storageRoot, ".covex-backup-storage"), marker, { mode: 0o600 });
    const storageInfo = statSync(storageRoot);
    const cfg = { environment: "test", approval_reference: "SYNTHETIC-4B2", release_sha: command("git", ["rev-parse", "HEAD"]), assets_consistency: "immutable-release", external_reference_policy: "references-only-accepted", application_root: root, assets: [{ label: "templates", path: assetRoot }], backup_directory: join(storageRoot, "backups"), backup_storage: { mode: "test-directory-identity", root: storageRoot, device: storageInfo.dev, inode: storageInfo.ino, marker_sha256: sha256(marker) }, temporary_directory: join(root, "plain"), encryption_key: join(root, keys[0]), manifest_key: join(root, keys[1]), status_directory: join(root, "status"), approved_recovery_hosts: [base.hostname], source: { host: base.hostname, port: Number(base.port || 5432), database: sourceName, user: role, passfile, sslmode: "disable" }, recovery: { host: base.hostname, port: Number(base.port || 5432), database: "postgres", user: decodeURIComponent(base.username), passfile, sslmode: "disable" } };
    const configFile = join(root, "config.json"); writeFileSync(configFile, JSON.stringify(cfg), { mode: 0o600 });
    const args = (operation: string, ...extra: string[]) => ["ops/backup/backup.py", operation, "--config", configFile, ...extra];
    function refused(extra: string[]) { const result = spawnSync("python3", extra, { env: pgEnv, encoding: "utf8", timeout: 120000 }); assert.notEqual(result.status, 0); assert.equal(JSON.parse(result.stdout.trim()).status, "failure"); }
    await source.$executeRawUnsafe('ALTER TABLE "AuditEvent" DISABLE TRIGGER audit_event_immutable');
    refused(args("backup"));
    await source.$executeRawUnsafe('ALTER TABLE "AuditEvent" ENABLE TRIGGER audit_event_immutable');
    // Private lease reads are allowed only to this read-only snapshot identity,
    // never to an application writer or a backup role with accidental DML.
    await source.$executeRawUnsafe(`GRANT SELECT ON "AuditBusinessContext" TO "${auditRole}"`);
    refused(args("backup"));
    await source.$executeRawUnsafe(`REVOKE SELECT ON "AuditBusinessContext" FROM "${auditRole}"`);
    await source.$executeRawUnsafe(`GRANT UPDATE(name) ON "Department" TO "${role}"`);
    refused(args("backup"));
    await source.$executeRawUnsafe(`REVOKE UPDATE(name) ON "Department" FROM "${role}"`);
    renameSync(storageRoot, storageRoot + "-absent");
    refused(args("backup")); assert(!readdirSync(root).includes("storage"), "El almacenamiento ausente no se recrea");
    renameSync(storageRoot + "-absent", storageRoot);
    writeFileSync(join(storageRoot, ".covex-backup-storage"), "substituted"); refused(args("backup"));
    assert.equal(readdirSync(cfg.backup_directory).length, 0, "El almacenamiento sustituido no recibe copias");
    writeFileSync(join(storageRoot, ".covex-backup-storage"), marker);
    const enrolled = cfg.backup_storage;
    Object.assign(cfg, { backup_storage: { mode: "mounted-filesystem", root: storageRoot, source: "synthetic", filesystem_type: "tmpfs", mount_root: "/", marker_sha256: sha256(marker) } });
    writeFileSync(configFile, JSON.stringify(cfg)); refused(args("backup"));
    assert.equal(JSON.parse(readFileSync(join(cfg.status_directory, "backup.json"), "utf8")).status, "failure", "El directorio sin montaje no registra éxito");
    cfg.backup_storage = enrolled; writeFileSync(configFile, JSON.stringify(cfg));
    command("python3", args("backup"), pgEnv);
    const bundle = join(cfg.backup_directory, readdirSync(cfg.backup_directory).find(n => n.startsWith("covex-"))!);
    const manifest = JSON.parse(readFileSync(join(bundle, "manifest.json"), "utf8"));
    assert.equal(manifest.database.external_references_without_custody, 1, "Una URL sigue sin ser un binario conservado");
    command("python3", args("verify", "--bundle", bundle), pgEnv);
    refused(args("restore", "--bundle", bundle, "--target", "covex_quality", "--confirm", "covex_quality", "--assets-out", join(root, "unsafe")));
    const changed = join(root, "changed"); cpSync(bundle, changed, { recursive: true });
    writeFileSync(join(changed, "database.dump.enc"), Buffer.from("altered"));
    refused(args("restore", "--bundle", changed, "--target", targetName, "--confirm", targetName, "--assets-out", join(root, "tamper")));
    assert.equal((await parent.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT count(*) FROM pg_database WHERE datname=${targetName}`))[0].count, BigInt(0), "El backup alterado no crea el destino");
    const inconsistent = join(root, "inconsistent"); cpSync(bundle, inconsistent, { recursive: true });
    command("python3", ["-c", "import importlib.util,json,pathlib,sys;s=importlib.util.spec_from_file_location('b','ops/backup/backup.py');b=importlib.util.module_from_spec(s);s.loader.exec_module(b);c=b.config(sys.argv[1]);p=pathlib.Path(sys.argv[2]);m=json.loads((p/'manifest.json').read_text());m['database']['tables']['QmsRecord']['rows']+=1;b.write_json(p/'manifest.json',m);(p/'manifest.mac').write_text(b.signature(m,c)+'\\n')", configFile, inconsistent], pgEnv);
    databases.push(failedName);
    refused(args("restore", "--bundle", inconsistent, "--target", failedName, "--confirm", failedName, "--assets-out", join(root, "failed-assets")));
    assert.equal(JSON.parse(readFileSync(join(cfg.status_directory, "restore.json"), "utf8")).status, "failure", "Una restauración con divergencia no se declara satisfactoria");
    // Isolated pg_restore shim weakens a NEW fixture after a genuine restore.
    const unsafeAuditName = "covex_phase4b1_test_4b2_restore_" + randomBytes(8).toString("hex"); databases.push(unsafeAuditName);
    const restoreTool = command("python3", ["-c", "import shutil;print(shutil.which('pg_restore'))"], pgEnv);
    const shim = join(root, "unsafe-audit-shim"); mkdirSync(shim);
    const shimCode = `#!/usr/bin/env python3\nimport os,subprocess,sys\nr=subprocess.run([${JSON.stringify(restoreTool)},*sys.argv[1:]])\nif r.returncode==0 and os.environ.get('PGDATABASE')==${JSON.stringify(unsafeAuditName)} and any(a.startswith('--dbname=') for a in sys.argv[1:]):\n subprocess.run(['psql','-X','-v','ON_ERROR_STOP=1','-c','ALTER TABLE "AuditEvent" DISABLE TRIGGER audit_event_immutable'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)\nsys.exit(r.returncode)\n`;
    writeFileSync(join(shim, "pg_restore"), shimCode, { mode: 0o700 });
    const badProtection = spawnSync("python3", args("restore", "--bundle", bundle, "--target", unsafeAuditName, "--confirm", unsafeAuditName, "--assets-out", join(root, "unprotected-assets")), { env: { ...pgEnv, PATH: shim + ":" + pgEnv.PATH }, encoding: "utf8", timeout: 120000 });
    assert.notEqual(badProtection.status, 0);
    assert.equal(JSON.parse(badProtection.stdout.trim()).reason, "audit-protection-unavailable", "La recuperación sin protección queda en cuarentena");
    // The source is unavailable: recovery relies only on artifact, keys and recovery server.
    cfg.source.port = 1; writeFileSync(configFile, JSON.stringify(cfg), { mode: 0o600 });
    refused(args("backup"));
    const recoveryBundle = join(root, "offline-recovery-bundle"); cpSync(bundle, recoveryBundle, { recursive: true });
    renameSync(storageRoot, storageRoot + "-disconnected");
    databases.push(targetName);
    command("python3", args("restore", "--bundle", recoveryBundle, "--target", targetName, "--confirm", targetName, "--assets-out", join(root, "restored-assets")), pgEnv);
    refused(args("restore", "--bundle", recoveryBundle, "--target", targetName, "--confirm", targetName, "--assets-out", join(root, "repeat")));
    const restoredUrl = new URL(base); restoredUrl.pathname = "/" + targetName;
    restored = new PrismaClient({ datasourceUrl: restoredUrl.href });
    assert.deepEqual(await restored.auditOperation.findMany({ orderBy: { id: "asc" } }), auditGolden.operations, "Journal recuperado sin fabricación de eventos históricos");
    assert.deepEqual(await restored.auditEvent.findMany({ orderBy: { id: "asc" } }), auditGolden.events);
    assert.deepEqual(await restored.auditOperationTarget.findMany({ orderBy: [{ rootKey: "asc" }, { aggregateSequence: "asc" }] }), auditGolden.targets);
    assert.deepEqual(await restored.auditAggregateCursor.findMany({ orderBy: { rootKey: "asc" } }), auditGolden.cursors);
    assert.deepEqual(await restored.auditCommandResult.findMany({ orderBy: { operationId: "asc" } }), auditGolden.receipts);
    assert.deepEqual(await restored.auditOperationEvidence.findMany({ orderBy: { id: "asc" } }), auditGolden.evidence);
    assert.deepEqual(await restored.auditEventAdditionalTarget.findMany({ orderBy: [{ eventId: "asc" }, { rootKey: "asc" }] }), auditGolden.additionalTargets);
    assert.deepEqual(await restored.signedDocumentCustody.findMany({ orderBy: { id: "asc" }, include: { originalDocument: true } }), auditGolden.custody, "Exact originals, historical identity, custodian, supersession links and SHA survive offline recovery");
    assert.deepEqual(await restored.recordVersionDocument.findMany({ orderBy: { id: "asc" } }), auditGolden.slots);
    assert.deepEqual(await restored.auditTechnicalEvent.findMany({ orderBy: { id: "asc" } }), auditGolden.technical);
    assert.equal(await restored.auditRuntimeContext.count(), 0);
    assert.equal(await restored.auditBusinessContext.count(), 0); assert.equal(await restored.auditMutationWitness.count(), 0); assert.equal(await restored.auditRootBinding.count(), 0);
    assert.equal(await restored.auditTechnicalContext.count(), 0);
    const nextAuditRole = "covex4b3_afterrestore_" + id; auditRoles.push(nextAuditRole);
    auditRestoredApp = await auditApplicationFixture(restored, restoredUrl, nextAuditRole);
    await businessApplicationGrantsFixture(restored, nextAuditRole);
    const replayed = await businessSqlFixture(auditRestoredApp, fixtureUsers.qa.id, editRequest, "DV02", "DEVIATION", "EDIT", "Synthetic recovered persisted correction", async () => { throw Error("Committed B2 command must not execute twice after restoration"); });
    assert.equal(replayed, auditGolden.operations.find(op => op.requestId === editRequest)!.id);
    const nextAudit = await auditedSqlFixture(auditRestoredApp, fixtureUsers.qa.id, [deviation.qmsRecordId!], randomUUID(), 8);
    assert.notEqual(nextAudit.operation_id, auditReceipt.operation_id);
    assert.equal((await restored.auditOperationTarget.findFirstOrThrow({ where: { operationId: nextAudit.operation_id } })).aggregateSequence, auditGolden.cursors.find(c => c.rootKey === "QMS_RECORD:" + deviation.qmsRecordId)!.lastSequence + BigInt(1));
    const nextBusiness = await businessSqlFixture(auditRestoredApp, fixtureUsers.qa.id, randomUUID(), "DV02", "DEVIATION", "EDIT", null, async tx => {
      await tx.deviation.update({ where: { id: deviation.id }, data: { internalObservations: "New B2 operation after isolated recovery" } });
    });
    assert.equal((await restored.auditOperationTarget.findFirstOrThrow({ where: { operationId: nextBusiness } })).aggregateSequence, auditGolden.cursors.find(c => c.rootKey === "QMS_RECORD:" + deviation.qmsRecordId)!.lastSequence + BigInt(2));
    const newEvent = await restored.auditEvent.findFirstOrThrow({ where: { operationId: nextBusiness, fieldPath: "internalObservations" } });
    assert.deepEqual(newEvent.oldValue, { present: true, type: "NULL", value: null });
    assert.deepEqual(newEvent.newValue, { present: true, type: "STRING", value: "New B2 operation after isolated recovery" });
    await assert.rejects(auditRestoredApp.$executeRawUnsafe('TRUNCATE "AuditEvent" CASCADE'));
    await assert.rejects(auditRestoredApp.$queryRaw`SELECT * FROM "AuditBusinessContext"`);
    await assert.rejects(auditRestoredApp.$queryRaw`SELECT * FROM "AuditTechnicalContext"`);
    await assert.rejects(restored.auditTechnicalEvent.update({ where: { id: auditGolden.technical[0].id }, data: { deletedPendingRows: 0 } }));
    assert.equal((await restored.controlledDocumentImportBatch.findUniqueOrThrow({ where: { id: stagingId } })).state, "EXPIRED");
    await assert.rejects(auditRestoredApp.signedDocumentCustody.delete({ where: { id: auditGolden.custody[0].id } }));
    await assert.rejects(auditRestoredApp.generatedDocument.update({ where: { id: auditGolden.custody[0].originalDocumentId }, data: { fileName: "forbidden-after-restore.pdf" } }));
    assert.deepEqual((await restored.qmsRecord.findMany({ orderBy: { id: "asc" }, select: { id: true } })).map(r => r.id), records.map(r => r.id), "UUID sin expedientes duplicados");
    assert.equal(await restored.qmsRecordVersion.count(), records.length * 2);
    assert.equal(await restored.qmsRelation.count(), 2);
    assert.equal(await restored.authSession.count({ where: { revokedAt: null } }), 0);
    assert.equal(await restored.authLoginAttempt.count(), 0);
    for (const [rows, expected] of [[await restored.templateVersion.findMany({ where: { fileData: { not: null } } }), sha256(word)], [await restored.controlledRevisionDocument.findMany({ where: { fileData: { not: null } } }), checksum], [await restored.auditAnnualProgrammeVersion.findMany(), sha256(sheet)]] as const) {
      for (const row of rows) assert.equal(sha256(Buffer.from(row.fileData!)), expected, "SHA-256 binario en cada familia documental");
    }
    for (const row of [...await restored.generatedDocument.findMany({ where: { fileData: { not: null } } }), ...await restored.recordVersionDocument.findMany()]) assert.equal(sha256(Buffer.from(row.fileData!)), row.checksum);
    assert.equal((await restored.deviation.findUniqueOrThrow({ where: { id: deviation.id } })).whatHappened, "B2 persisted recovered correction");
    assert.equal(await restored.deviationImmediateAction.count({ where: { deviationId: deviation.id, description: "B2 recovered child" } }), 1);
    assert.deepEqual(readFileSync(join(root, "restored-assets/templates/fixture.docx")), asset);
    const release = join(root, "release"); command("python3", ["ops/release.py", "--sha", cfg.release_sha, "--out", release]);
    const restoredEnv = { ...env, DATABASE_URL: restoredUrl.href, HOSTNAME: "127.0.0.1", PORT: "3102" };
    provider = spawn("node", ["--import", "tsx", "scripts/auth-fixtures/provider.ts"], { env: restoredEnv, stdio: "ignore" });
    app = spawn("node", [join(release, "server.js")], { cwd: release, env: restoredEnv, stdio: "ignore" });
    await ready(env.AUTH_TEST_ISSUER + "/.well-known/openid-configuration", provider);
    await ready(env.AUTH_ORIGIN + "/api/health", app);
    assert.equal((await fetch(env.AUTH_ORIGIN + "/api/auth/session", { headers: { cookie: "covex-session=" + oldToken } })).status, 401, "Sesión anterior al backup revocada realmente");
    const previousEnv = { DATABASE_URL: process.env.DATABASE_URL, AUTH_ORIGIN: process.env.AUTH_ORIGIN, AUTH_TEST_ISSUER: process.env.AUTH_TEST_ISSUER };
    Object.assign(process.env, { DATABASE_URL: restoredUrl.href, AUTH_ORIGIN: env.AUTH_ORIGIN, AUTH_TEST_ISSUER: env.AUTH_TEST_ISSUER });
    try {
      const login = await fixtureLogin("reader"); assert(login.success, "Nuevo login OIDC después de recuperar");
      const user = await fetch(env.AUTH_ORIGIN + "/api/auth/session", { headers: { cookie: cookieHeader(login.jar) } }); assert(user.ok); assert.equal((await user.json()).name, fixtureUsers.reader.name);
      for (const path of ["deviations", "capa", "changes", "complaints", "returns", "audits", "controlled-documents"]) assert.equal((await fetch(env.AUTH_ORIGIN + "/" + path, { headers: { cookie: cookieHeader(login.jar) }, redirect: "manual" })).status, 200);
      await businessSqlFixture(auditRestoredApp, fixtureUsers.admin.id, randomUUID(), "TR05", "SYSTEM", "MANAGE_USERS", "Synthetic post-recovery access withdrawal", async tx => {
        await tx.authUser.update({ where: { id: fixtureUsers.reader.id }, data: { active: false } });
      });
      assert.equal((await fetch(env.AUTH_ORIGIN + "/api/auth/session", { headers: { cookie: cookieHeader(login.jar) } })).status, 401, "Revocación 4B1 sigue efectiva tras recuperación");
    } finally { Object.assign(process.env, previousEnv); }
    command("node", [resolve("ops/runtime/health.mjs"), env.AUTH_ORIGIN + "/api/health"]);
    await stop(app); app = undefined;
    await assert.rejects(fetch(env.AUTH_ORIGIN + "/api/health"), "Parada efectiva del servicio aislado");
    console.log("4B2 recovery OK: absent/unmounted/substituted storage refused without creating backups; enrolled test storage positive; PostgreSQL16 consistent encrypted backup; seven modules, relationships, frozen versions/history, binary families and external files; B1 and B2 operations, typed OLD/NEW, evidence, receipts, targets and cursors preserved; exact signed originals and supersession chains restored, protected and replay-safe; next sequence writable, weakened protection quarantined; tamper/unsafe/existing targets rejected; unavailable source and backup storage recovery; session revocation, fresh OIDC/global read and access withdrawal; standalone health/start/stop. Synthetic only, pending corporate IT/QA acceptance.");
  } finally {
    await stop(app); await stop(provider); await auditSourceApp?.$disconnect(); await auditRestoredApp?.$disconnect(); await restored?.$disconnect(); await source.$disconnect();
    for (const database of databases.reverse()) {
      await parent.$executeRaw(Prisma.sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=${database} AND pid<>pg_backend_pid()`);
      await parent.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}"`);
    }
    await parent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${role}"`);
    for (const auditRole of auditRoles) await parent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${auditRole}"`);
    await parent.$disconnect();
    if (pgContainer && pgPassPath) command("docker", ["exec", pgContainer, "rm", "-f", pgPassPath]);
    rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Synthetic recovery failed"); process.exitCode = 1; });
