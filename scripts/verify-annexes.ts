import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Prisma, type DocumentType, type QmsRecordType } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { withBytes } from "../src/lib/db-binary-omit";
import { isolatedTestEnvironment } from "../src/lib/auth/config";
import { compareExcelAnnex, compareWordAnnex, tokenDecoder, type AnnexComparison } from "../src/lib/ooxml/annex-verification";
import { getZipEntryText, readZip } from "../src/lib/ooxml/zip";
import { annexGeneratorXml } from "../src/modules/configuration/annex-generator-views";
import { collectTemplateFiles, type InputFile } from "../src/modules/configuration/template-install";
import { installProblems, installTemplateFiles } from "../src/modules/configuration/template-install-service";
import { generateAnnexIII } from "../src/modules/deviations/documents/annex-iii";
import { generateAnnexV } from "../src/modules/deviations/documents/xlsx";
import { getDeviationDetail } from "../src/modules/deviations/queries";
import { getDeviationExportRows } from "../src/modules/deviations/documents/export-data";
import { DEVIATION_TABLE_FIELDS } from "../src/modules/deviations/text-tables";
import { generateCapaAnnexIII } from "../src/modules/capa/documents/annex-iii";
import { generateCapaAnnexIV } from "../src/modules/capa/documents/xlsx";
import { getCapaDetail } from "../src/modules/capa/queries";
import { getCapaExportRows } from "../src/modules/capa/documents/export-data";
import { CAPA_TABLE_FIELDS, actionFollowupTablesKey } from "../src/modules/capa/text-tables";
import { generateChangeAnnexIII } from "../src/modules/change-control/documents/annex-iii";
import { generateChangeAnnexIV } from "../src/modules/change-control/documents/annex-iv";
import { generateChangeAnnexV } from "../src/modules/change-control/documents/annex-v";
import { generateChangeAnnexVII } from "../src/modules/change-control/documents/xlsx";
import { getChangeControlDetail } from "../src/modules/change-control/queries";
import { getChangeControlExportRows } from "../src/modules/change-control/documents/export-data";
import { CHANGE_CONTROL_TABLE_FIELDS } from "../src/modules/change-control/text-tables";
import { generateComplaintAnnexIII, generateComplaintAnnexIV } from "../src/modules/complaints/documents/docx";
import { generateComplaintAnnexV } from "../src/modules/complaints/documents/xlsx";
import { getComplaintDetail } from "../src/modules/complaints/queries";
import { getComplaintExportRows } from "../src/modules/complaints/documents/export-data";
import { COMPLAINT_TABLE_FIELDS } from "../src/modules/complaints/text-tables";
import { generateReturnAnnexIII, generateReturnAnnexIV, generateReturnAnnexV } from "../src/modules/returns/documents/docx";
import { generateReturnAnnexVI } from "../src/modules/returns/documents/xlsx";
import { getReturnDetail } from "../src/modules/returns/queries";
import { getReturnExportRows } from "../src/modules/returns/documents/export-data";
import { RETURN_TABLE_FIELDS } from "../src/modules/returns/text-tables";
import { fillOosAnnexIII, fillOosAnnexIV, fillOosAnnexVI, type OosDocumentRecord } from "../src/modules/oos/documents/docx";
import { oosEvaluationKeys } from "../src/modules/oos/domain";
import { OOS_TABLE_FIELDS } from "../src/modules/oos/text-tables";
import { generateAuditCapaPlan, generateAuditExternalPlan, generateAuditReport } from "../src/modules/audits/documents/generators";
import { extractExternalProgramme, generateAnnualProgramme } from "../src/modules/audits/annual-programme/generator";
import { auditReportInclude, snapshotAudit } from "../src/modules/audits/report-service";

// D-128: verificación de los anexos con las plantillas reales, repetible antes de cada actualización.
// Crea en una base de datos desechable los expedientes de demostración, instala las plantillas por su
// huella (D-099), sustituye cada texto por un marcador único y cada fecha por una fecha distinta, añade una
// tabla a cada texto que la admite, genera los anexos con los generadores de la aplicación y los compara
// casilla a casilla con su plantilla. Las plantillas y lo generado se quedan en la carpeta de salida, fuera
// de Git; el repositorio no guarda nada de su contenido.
//
//   DATABASE_URL=postgresql://…/covex_annexes_verify pnpm annexes:verify -- --out informe-anexos plantillas/
//
// Sale con error si cambia texto de una plantilla, si un campo deja de imprimirse sin estar en la lista de
// campos que no se imprimen a propósito (scripts/verify-annexes-expected.json) o si una tabla no sale en la
// casilla de su texto.

const EXPECTED_FILE = path.join(__dirname, "verify-annexes-expected.json");
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const flag = (name: string) => { const at = args.indexOf(name); if (at < 0) return null; const [, value] = args.splice(at, 2); return value ?? null; };
const writeExpected = args.includes("--write-expected");
if (writeExpected) args.splice(args.indexOf("--write-expected"), 1);
const skipSetup = args.includes("--skip-setup");
if (skipSetup) args.splice(args.indexOf("--skip-setup"), 1);
const out = path.resolve(flag("--out") ?? "informe-anexos");
const sources = args.length ? args : ["plantillas"];

/** Solo en una base de datos desechable: nunca en la de trabajo. */
function assertDisposableDatabase() {
  const name = (() => { try { return new URL(process.env.DATABASE_URL ?? "").pathname.slice(1); } catch { /* URL no válida: no es desechable. */ return ""; } })();
  if (name.startsWith("covex_annexes_verify") || isolatedTestEnvironment()) return;
  throw new Error(`La verificación crea datos de prueba: usa una base de datos desechable cuyo nombre empiece por «covex_annexes_verify» (ahora: «${name || "sin DATABASE_URL"}»).`);
}

const models = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));
const skipModels = new Set(["TemplateVersion", "FormVersion", "QmsRecordVersion", "GeneratedDocument", "AuthUser", "Department"]);
const keepStrings = new Set(["businessCode", "annulledBusinessCode", "versionCode", "checksum", "fileName", "mimeType", "departmentCodeSnapshot", "departmentNameSnapshot"]);
const dates: Record<string, string> = {};
let dateIndex = 0;
const tokens: Record<string, string[]> = {};
const uniqueDate = (field: string) => {
  const date = new Date(Date.UTC(2031, 0, 1 + dateIndex++));
  dates[date.toISOString().slice(0, 10)] = field;
  return date;
};

/** Sustituye cada texto por `⟦Modelo.campo⟧` y cada fecha por una fecha única, en el registro y sus relaciones. */
function tokenize(value: Record<string, unknown>, model: string, prefix: string, bag: string[]) {
  const meta = models.get(model);
  if (!meta || skipModels.has(model)) return value;
  for (const field of meta.fields) {
    const key = field.name, current = value[key];
    if (!(key in value)) continue;
    if (field.kind === "scalar" && field.type === "String" && !field.isList && !field.isId && !/Id$/.test(key) && !keepStrings.has(key) && !(typeof current === "string" && /^[A-Z][A-Z0-9_]*$/.test(current))) {
      value[key] = `⟦${prefix}.${key}⟧`;
      bag.push(`${prefix}.${key}`);
    } else if (field.kind === "scalar" && field.type === "DateTime" && !["createdAt", "updatedAt"].includes(key)) {
      value[key] = uniqueDate(`${prefix}.${key}`);
    } else if (field.kind === "object" && current) {
      if (Array.isArray(current)) current.forEach((item, index) => tokenize(item as Record<string, unknown>, field.type, `${field.type}[${index + 1}]`, bag));
      else tokenize(current as Record<string, unknown>, field.type, field.type, bag);
    }
  }
  if ("additionalLots" in value) value.additionalLots = [{ kind: model === "Deviation" ? "MATERIAL" : undefined, name: `⟦${prefix}.otroLote.nombre⟧`, lot: `⟦${prefix}.otroLote.lote⟧`, size: `⟦${prefix}.otroLote.tamaño⟧`, quantity: `⟦${prefix}.otroLote.cantidad⟧` }];
  return value;
}

/** Una tabla de prueba en cada texto que admite tablas (D-127), con su campo en el título. */
function addTables(record: Record<string, unknown>, model: string, fields: readonly string[], extra: string[] = []) {
  record.textTables = Object.fromEntries([...fields, ...extra].map((field) => [field, [{ title: `⟦tabla.${model}.${field}⟧`, columns: ["Dato"], rows: [["valor"]] }]]));
}

type Annex = { name: string; module: string; template: Buffer; output: Buffer; kind: "docx" | "xlsx"; documentType?: DocumentType; versionCode?: string; tables?: Array<{ table: string; field: string }> };
const annexes: Annex[] = [];
const failures: string[] = [];

async function activeTemplate(module: QmsRecordType, documentType: DocumentType) {
  // La activa si la hay; si no, la última instalada (la que usan los generadores por defecto).
  // Los binarios no se leen por defecto (BE1-A): se piden expresamente.
  const installed = await prisma.templateVersion.findMany({ where: { module, documentType }, omit: withBytes, orderBy: { createdAt: "desc" } });
  const template = installed.find((item) => item.isActive && item.fileData) ?? installed.find((item) => item.fileData);
  if (!template?.fileData) throw new Error(`No hay plantilla instalada de ${documentType}.`);
  return { data: Buffer.from(template.fileData), versionCode: template.versionCode };
}

async function add(name: string, module: string, module_: QmsRecordType, documentType: DocumentType, generate: () => Promise<Buffer> | Buffer, tables?: Annex["tables"]) {
  try {
    const template = await activeTemplate(module_, documentType);
    const output = await generate();
    annexes.push({ name, module, template: template.data, output, kind: name.endsWith(".xlsx") ? "xlsx" : "docx", documentType, versionCode: template.versionCode, tables });
  } catch (error) {
    failures.push(`${name}: no se ha podido generar (${error instanceof Error ? error.message : String(error)})`);
  }
}

const bag = (module: string) => (tokens[module] ??= []);
const tablePairs = (model: string, fields: readonly string[]) => fields.map((field) => ({ table: `tabla.${model}.${field}`, field: `${model}.${field}` }));

async function generateAll() {
  const demo = async (recordType: QmsRecordType, businessCode: string) => (await prisma.qmsRecord.findUniqueOrThrow({ where: { recordType_businessCode: { recordType, businessCode } }, select: { id: true } })).id;
  const only = <T extends { qmsRecord?: { businessCode: string | null } | null }>(rows: T[], code: string) => rows.filter((row) => row.qmsRecord?.businessCode === code);

  // Desviaciones.
  const deviationRecord = await prisma.deviation.findFirstOrThrow({ where: { qmsRecordId: await demo("DEVIATION", "DEMO-DES-001-2026") }, select: { id: true } });
  const deviation = tokenize((await getDeviationDetail(deviationRecord.id)) as never, "Deviation", "Deviation", bag("deviation")) as Record<string, unknown>;
  addTables(deviation, "Deviation", DEVIATION_TABLE_FIELDS);
  await add("DV_III.docx", "deviation", "DEVIATION", "DEVIATION_ANNEX_III", () => generateAnnexIII({ ...deviation, recordVersionLabel: "V00" } as never), tablePairs("Deviation", DEVIATION_TABLE_FIELDS));
  const deviationRows = only(await getDeviationExportRows({ year: ["2026"] }) as never[], "DEMO-DES-001-2026").map((row) => tokenize(row as never, "Deviation", "Deviation", []));
  await add("DV_V.xlsx", "deviation", "DEVIATION", "DEVIATION_ANNEX_V", () => generateAnnexV(2026, deviationRows as never, "06"));

  // CAPA.
  const capaId = (await prisma.capa.findFirstOrThrow({ where: { qmsRecordId: await demo("CAPA", "DEMO-CAPA-001-2026") }, select: { id: true } })).id;
  const capa = tokenize((await getCapaDetail(capaId)) as never, "Capa", "Capa", bag("capa")) as Record<string, unknown> & { actionFollowups: unknown[]; openedAt: Date };
  const followupKeys = capa.actionFollowups.map((_, index) => actionFollowupTablesKey(index));
  addTables(capa, "Capa", CAPA_TABLE_FIELDS, followupKeys);
  await add("CA_III.docx", "capa", "CAPA", "CAPA_ANNEX_III", () => generateCapaAnnexIII({ ...capa, recordVersionSequenceNumber: 0, recordVersionReason: null, versionFollowupDate: capa.openedAt } as never), [
    ...tablePairs("Capa", CAPA_TABLE_FIELDS),
    ...followupKeys.map((key, index) => ({ table: `tabla.Capa.${key}`, field: `CapaActionFollowup[${index + 1}].description` })),
  ]);
  const capaRows = only(await getCapaExportRows({ year: ["2026"] }) as never[], "DEMO-CAPA-001-2026").map((row) => tokenize(row as never, "Capa", "Capa", []));
  await add("CA_IV.xlsx", "capa", "CAPA", "CAPA_ANNEX_IV", () => generateCapaAnnexIV(2026, capaRows as never, "05"));

  // Controles de cambios.
  const changeId = (await prisma.changeControl.findFirstOrThrow({ where: { qmsRecordId: await demo("CHANGE_CONTROL", "DEMO-CC-001-2026") }, select: { id: true } })).id;
  const change = tokenize((await getChangeControlDetail(changeId)) as never, "ChangeControl", "ChangeControl", bag("change")) as Record<string, unknown> & { followups: Array<{ sequenceNumber: number }> };
  addTables(change, "ChangeControl", CHANGE_CONTROL_TABLE_FIELDS);
  const changeTables = tablePairs("ChangeControl", CHANGE_CONTROL_TABLE_FIELDS);
  await add("CC_III.docx", "change", "CHANGE_CONTROL", "CHANGE_ANNEX_III", () => generateChangeAnnexIII(change as never), changeTables);
  await add("CC_IV.docx", "change", "CHANGE_CONTROL", "CHANGE_ANNEX_IV", () => generateChangeAnnexIV(change as never), changeTables);
  if (change.followups.length) await add("CC_V.docx", "change", "CHANGE_CONTROL", "CHANGE_ANNEX_V", () => generateChangeAnnexV(change as never, change.followups[0].sequenceNumber));
  else failures.push("CC_V.docx: el control de cambios de demostración no tiene seguimientos");
  const changeRows = only(await getChangeControlExportRows({ year: ["2026"] }) as never[], "DEMO-CC-001-2026").map((row) => tokenize(row as never, "ChangeControl", "ChangeControl", []));
  await add("CC_VII.xlsx", "change", "CHANGE_CONTROL", "CHANGE_ANNEX_VII", () => generateChangeAnnexVII(2026, changeRows as never, "03"));

  // Reclamaciones.
  const complaintId = (await prisma.complaint.findFirstOrThrow({ where: { qmsRecordId: await demo("COMPLAINT", "DEMO-REC-001-2026") }, select: { id: true } })).id;
  const complaint = tokenize((await getComplaintDetail(complaintId)) as never, "Complaint", "Complaint", bag("complaint")) as Record<string, unknown>;
  addTables(complaint, "Complaint", COMPLAINT_TABLE_FIELDS);
  await add("RC_III.docx", "complaint", "COMPLAINT", "COMPLAINT_ANNEX_III", () => generateComplaintAnnexIII(complaint as never), tablePairs("Complaint", COMPLAINT_TABLE_FIELDS));
  await add("RC_IV.docx", "complaint", "COMPLAINT", "COMPLAINT_ANNEX_IV", () => generateComplaintAnnexIV(complaint as never));
  const complaintRows = only(await getComplaintExportRows({ year: ["2026"] }) as never[], "DEMO-REC-001-2026").map((row) => tokenize(row as never, "Complaint", "Complaint", []));
  await add("RC_V.xlsx", "complaint", "COMPLAINT", "COMPLAINT_ANNEX_V", () => generateComplaintAnnexV(2026, complaintRows as never));

  // Devoluciones.
  const returnId = (await prisma.returnRecord.findFirstOrThrow({ where: { qmsRecordId: await demo("RETURN", "DEMO-DEVOL-001-2026") }, select: { id: true } })).id;
  const returned = tokenize((await getReturnDetail(returnId)) as never, "ReturnRecord", "ReturnRecord", bag("return")) as Record<string, unknown> & { products: unknown[] };
  // La justificación del plazo excepcional se guarda en extraData.r4b (JSON): también lleva marcador.
  const extraData = (returned.extraData ?? {}) as Record<string, Record<string, unknown> | undefined>;
  returned.extraData = { ...extraData, r4b: { ...(extraData.r4b ?? {}), ambientPeriodRiskJustification: "⟦ReturnRecord.ambientPeriodRiskJustification⟧" } };
  bag("return").push("ReturnRecord.ambientPeriodRiskJustification");
  addTables(returned, "ReturnRecord", RETURN_TABLE_FIELDS);
  const returnTables = tablePairs("ReturnRecord", RETURN_TABLE_FIELDS);
  await add("DE_III.docx", "return", "RETURN", "RETURN_ANNEX_III", () => generateReturnAnnexIII(returned as never), returnTables);
  await add("DE_IV.docx", "return", "RETURN", "RETURN_ANNEX_IV", () => generateReturnAnnexIV(returned as never, returned.products[0] as never));
  await add("DE_V.docx", "return", "RETURN", "RETURN_ANNEX_V", () => generateReturnAnnexV(returned as never), returnTables);
  const returnRows = only(await getReturnExportRows({ year: ["2026"] }) as never[], "DEMO-DEVOL-001-2026").map((row) => tokenize(row as never, "ReturnRecord", "ReturnRecord", []));
  await add("DE_VI.xlsx", "return", "RETURN", "RETURN_ANNEX_VI", () => generateReturnAnnexVI(2026, returnRows as never));

  // OOS: no hay OOS de demostración; se construye uno completo en memoria (Fase I y Fase II).
  const oos: Record<string, unknown> = {};
  for (const field of models.get("OosRecord")!.fields) if (field.kind === "scalar" && !field.isId && !/Id$/.test(field.name)) oos[field.name] = null;
  tokenize(oos, "OosRecord", "OosRecord", bag("oos"));
  Object.assign(oos, {
    status: "CLOSED", area: "MD", materialKind: "FINISHED_PRODUCT", phaseIDisposition: "FULL_SCALE", phaseIVerdict: "REJECTED", phaseIIVerdict: "OTHER", investigationResult: "CONFIRMED",
    rootCauseCategories: [], additionalLots: [],
    phaseIEvaluation: Object.fromEntries(oosEvaluationKeys.map((key) => [key, `⟦eval.${key}⟧`])),
    qmsRecord: { businessCode: "OOS/MD/001/2031", sourceRelations: [{ targetRecord: { recordType: "CAPA", businessCode: "CAPA-REL-001", annulledBusinessCode: null } }] },
  });
  bag("oos").push(...oosEvaluationKeys.map((key) => `eval.${key}`));
  addTables(oos, "OosRecord", OOS_TABLE_FIELDS);
  const oosTables = tablePairs("OosRecord", OOS_TABLE_FIELDS);
  const oosTemplate = async (documentType: DocumentType) => (await activeTemplate("OOS", documentType)).data;
  await add("OO_III.docx", "oos", "OOS", "OOS_ANNEX_III", async () => fillOosAnnexIII(await oosTemplate("OOS_ANNEX_III"), oos as unknown as OosDocumentRecord), oosTables);
  await add("OO_IV.docx", "oos", "OOS", "OOS_ANNEX_IV", async () => fillOosAnnexIV(await oosTemplate("OOS_ANNEX_IV"), oos as unknown as OosDocumentRecord), oosTables);
  await add("OO_VI.docx", "oos", "OOS", "OOS_ANNEX_VI", async () => fillOosAnnexVI(await oosTemplate("OOS_ANNEX_VI"), 2031, [oos as unknown as OosDocumentRecord]));

  // Auditorías: informes interno y externo, CAPA plan, plan externo y programas anuales.
  const audit = tokenize((await prisma.audit.findFirstOrThrow({ where: { qmsRecordId: await demo("AUDIT", "DEMO-AUD-001-2026") }, include: auditReportInclude })) as never, "Audit", "Audit", bag("audit"));
  const auditTemplate = async (documentType: DocumentType) => (await activeTemplate("AUDIT", documentType)).data;
  await add("AU_INT.docx", "audit", "AUDIT", "AUDIT_INTERNAL_REPORT", async () => generateAuditReport(await auditTemplate("AUDIT_INTERNAL_REPORT"), snapshotAudit({ ...audit, scenario: "INTERNAL_GENERAL" } as never, []), 1));
  const external = snapshotAudit({ ...audit, scenario: "SUPPLIER" } as never, []);
  await add("AU_EXT.docx", "audit", "AUDIT", "AUDIT_EXTERNAL_REPORT", async () => generateAuditReport(await auditTemplate("AUDIT_EXTERNAL_REPORT"), external, 1));
  await add("AU_CAPA.xlsx", "audit", "AUDIT", "AUDIT_CAPA_PLAN", async () => generateAuditCapaPlan(await auditTemplate("AUDIT_CAPA_PLAN"), external, 1));
  await add("AU_PLAN.docx", "audit", "AUDIT", "AUDIT_EXTERNAL_PLAN", async () => generateAuditExternalPlan(await auditTemplate("AUDIT_EXTERNAL_PLAN"), external));
  const programmeRow = (i: number) => ({ entryId: `e${i}`, auditId: null, subject: `⟦prog${i}.subject⟧`, target: `⟦prog${i}.target⟧`, area: `⟦prog${i}.area⟧`, productService: `⟦prog${i}.productService⟧`, scope: `⟦prog${i}.scope⟧`, modality: `⟦prog${i}.modality⟧`, planned: `⟦prog${i}.planned⟧`, auditors: `⟦prog${i}.auditors⟧`, performed: `⟦prog${i}.performed⟧`, partial: `⟦prog${i}.partial⟧`, notes: `⟦prog${i}.notes⟧`, auditStatus: null, auditActive: null });
  bag("programme").push(...[1, 2].flatMap((i) => ["subject", "target", "area", "productService", "scope", "modality", "planned", "auditors", "performed", "partial", "notes"].map((key) => `prog${i}.${key}`)), "prog.title", "prog.technicalApproverName", "prog.qualityApproverName");
  for (const [auditType, documentType, name] of [["INTERNAL", "AUDIT_ANNUAL_INTERNAL_PROGRAMME", "AU_PMAI.docx"], ["EXTERNAL", "AUDIT_ANNUAL_EXTERNAL_PROGRAMME", "AU_PMAE.docx"]] as const) {
    await add(name, "programme", "AUDIT", documentType, async () => generateAnnualProgramme(await auditTemplate(documentType), {
      schemaVersion: 1, planId: "p", year: 2031, auditType, title: "⟦prog.title⟧",
      reference: auditType === "INTERNAL" ? "Anexo/PMAI/V04/01-2023" : "ANEXO I del PMAE/V05/06-2026",
      technicalApproverName: "⟦prog.technicalApproverName⟧", qualityApproverName: "⟦prog.qualityApproverName⟧", rows: [programmeRow(1), programmeRow(2)], warnings: [],
    } as never));
  }
}

/**
 * Una sustitución prevista de texto de la plantilla (un marcador como «fecha» o «(Nombre)» que la aplicación
 * cambia por el dato), guardada sin su texto: posición y huella. El repositorio es público y no debe
 * guardar contenido de las plantillas; si la plantilla o el relleno cambian, la huella deja de coincidir.
 */
function alterationKey(line: string) {
  const [where] = line.split(": ");
  return `${where}#${createHash("sha256").update(line).digest("hex").slice(0, 12)}`;
}

function compare(annex: Annex): AnnexComparison {
  const decode = tokenDecoder(dates);
  if (annex.kind === "xlsx") return compareExcelAnnex(annex.template, annex.output, decode);
  const templateXml = getZipEntryText(readZip(annex.template), "word/document.xml");
  // La parte de la plantilla que rellena el generador (recortada del PNT o del plan maestro si procede).
  const view = annex.documentType === "AUDIT_ANNUAL_EXTERNAL_PROGRAMME" ? extractExternalProgramme(templateXml)
    : annex.documentType ? annexGeneratorXml(annex.documentType, annex.versionCode ?? "", templateXml) : templateXml;
  return compareWordAnnex(view, getZipEntryText(readZip(annex.output), "word/document.xml"), decode);
}

/** Cada tabla debe salir en la casilla donde sale el texto de su campo (y solo si sale ese texto). */
function tableProblems(annex: Annex, result: AnnexComparison) {
  const problems: string[] = [];
  for (const { table, field } of annex.tables ?? []) {
    const fieldCells = result.cells.filter((cell) => cell.text.includes(`⟦${field}⟧`));
    const tableCells = result.cells.filter((cell) => cell.text.includes(`⟦${table}⟧`));
    if (fieldCells.length && !tableCells.length) problems.push(`La tabla de «${field}» no sale (su texto sí: ${fieldCells[0].where}).`);
    for (const cell of tableCells) if (!cell.text.includes(`⟦${field}⟧`)) problems.push(`La tabla de «${field}» sale en ${cell.where}, que no tiene su texto.`);
  }
  return problems;
}

async function setup() {
  const env = { ...process.env, ALLOW_DEMO_DATA: "true" };
  const run = (command: string, commandArgs: string[]) => execFileSync(command, commandArgs, { stdio: "inherit", env });
  run("pnpm", ["exec", "prisma", "migrate", "deploy"]);
  run("pnpm", ["-s", "db:seed"]);
  run("pnpm", ["-s", "demo:seed"]);
  const files: InputFile[] = [];
  for (const source of sources) {
    if (!existsSync(source)) throw new Error(`No existe «${source}».`);
    collectTemplateFiles(path.resolve(source), files);
  }
  const report = await installTemplateFiles(files, { actor: "Verificación de anexos", origin: "pnpm annexes:verify" });
  for (const line of report.lines) console.log(`${line.status === "installed" ? "✓" : line.status === "unchanged" ? "=" : "✗"} ${line.label} · ${line.versionCode}: ${line.message}`);
  if (installProblems(report)) console.log("Aviso: algunas plantillas no se han podido instalar; sus anexos saldrán como no generados.");
}

async function main() {
  assertDisposableDatabase();
  if (!skipSetup) await setup();
  await generateAll();
  mkdirSync(out, { recursive: true });
  type Expected = { notPrinted: string[]; replacedTemplateText: string[] };
  const expected: Record<string, Expected> = existsSync(EXPECTED_FILE) ? JSON.parse(readFileSync(EXPECTED_FILE, "utf8")) : {};
  const newExpected: Record<string, Expected> = {};
  const report: string[] = [`# Verificación de anexos con las plantillas reales`, "", `Generado el ${new Date().toISOString().slice(0, 10)}. Método y criterios en docs/ANNEX_VERIFICATION.md (D-128).`, ""];
  const summary: string[] = ["| Anexo | Plantilla | Texto de plantilla cambiado no previsto | Campos no impresos no previstos | Tablas fuera de su casilla | Resultado |", "|---|---|---|---|---|---|"];
  let problems = failures.length;
  for (const annex of annexes) {
    const base = annex.name.replace(/\.(docx|xlsx)$/, ""), extension = annex.kind;
    writeFileSync(path.join(out, `${base}.${extension}`), annex.output);
    writeFileSync(path.join(out, `${base}.plantilla.${extension}`), annex.template);
    const result = compare(annex);
    const all = [...new Set(tokens[annex.module] ?? [])];
    const notPrinted = all.filter((field) => !result.printed.has(field)).sort();
    const replaced = result.altered.map(alterationKey);
    newExpected[base] = { notPrinted, replacedTemplateText: replaced };
    const known = expected[base] ?? { notPrinted: [], replacedTemplateText: [] };
    const allowedFields = new Set(known.notPrinted), allowedText = new Set(known.replacedTemplateText);
    const unexpectedFields = writeExpected ? [] : notPrinted.filter((field) => !allowedFields.has(field));
    const unexpectedText = writeExpected ? [] : result.altered.filter((line) => !allowedText.has(alterationKey(line)));
    const nowPrinted = [...allowedFields].filter((field) => !notPrinted.includes(field));
    const tables = tableProblems(annex, result);
    const failed = unexpectedText.length + unexpectedFields.length + tables.length;
    problems += failed;
    summary.push(`| ${base} | ${annex.versionCode ?? ""} | ${unexpectedText.length} | ${unexpectedFields.length} | ${tables.length} | ${failed ? "✗" : "✓"} |`);
    report.push(`## ${base} (plantilla ${annex.versionCode ?? "—"})`, "", `### Casillas rellenadas (${result.filled.length})`, "");
    report.push(...result.filled.map((item) => `- ${item.where} · ${item.label} → ${item.text.slice(0, 300)}`), "");
    report.push(`### Texto de la plantilla que cambia (${result.altered.length}; ${unexpectedText.length} no previsto)`, "");
    report.push(...(result.altered.length ? result.altered.map((line) => `- ${unexpectedText.includes(line) ? "✗ NO PREVISTO · " : "previsto · "}${line}`) : ["—"]), "");
    report.push(`### Tablas de los textos (${tables.length} problemas)`, "", ...(tables.length ? tables.map((line) => `- ${line}`) : [annex.tables?.length ? "Cada tabla sale en la casilla de su texto." : "—"]), "");
    report.push(`### Campos del expediente que no se imprimen (${notPrinted.length} de ${all.length})`, "", notPrinted.join(", ") || "—", "");
    if (unexpectedFields.length) report.push(`**No previstos (fallo):** ${unexpectedFields.join(", ")}`, "");
    if (nowPrinted.length) report.push(`Ahora sí se imprimen (se pueden quitar de la lista): ${nowPrinted.join(", ")}`, "");
  }
  if (failures.length) report.push("## No generados", "", ...failures.map((line) => `- ${line}`), "");
  report.splice(4, 0, ...summary, "");
  writeFileSync(path.join(out, "INFORME.md"), report.join("\n"));
  if (writeExpected) writeFileSync(EXPECTED_FILE, JSON.stringify(newExpected, null, 2) + "\n");
  console.log(summary.join("\n"));
  console.log(`\nInforme: ${path.join(out, "INFORME.md")}`);
  if (problems && !writeExpected) {
    console.log(`\n✗ ${problems} problema(s). Revisa el informe.`);
    process.exitCode = 1;
  } else console.log(writeExpected ? "\nLista de campos que no se imprimen actualizada; revísala antes de versionarla." : "\n✓ Todos los anexos se rellenan como se espera.");
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
