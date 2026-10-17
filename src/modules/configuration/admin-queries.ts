import "server-only";
import { Prisma, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";

export function moduleLabel(module:QmsRecordType){
  return ({
    DEVIATION:"Desviaciones",
    AUDIT:"Auditorías",
    CAPA:"CAPA",
    CHANGE_CONTROL:"Controles de Cambios",
    COMPLAINT:"Reclamaciones",
    RETURN:"Devoluciones",
    OOS:"OOS",
  } as Record<QmsRecordType,string>)[module];
}

export async function getAdministrationOverview(){
  const [departments,catalogs,forms,templates,parameters,alertRules,history]=await Promise.all([
    prisma.department.findMany({orderBy:[{isActive:"desc"},{code:"asc"}]}),
    prisma.lookupCatalog.findMany({include:{items:{orderBy:[{isActive:"desc"},{sortOrder:"asc"},{label:"asc"}]}},orderBy:[{isActive:"desc"},{label:"asc"}]}),
    prisma.formVersion.findMany({include:{_count:{select:{fieldConfigs:true,deviations:true,capas:true,changeControls:true,complaints:true,returnRecords:true}}},orderBy:[{module:"asc"},{effectiveFrom:"desc"},{createdAt:"desc"}]}),
    prisma.templateVersion.findMany({
      select:{
        id:true,module:true,documentType:true,versionCode:true,filePath:true,fileName:true,mimeType:true,fileSize:true,checksum:true,effectiveFrom:true,effectiveTo:true,isActive:true,createdAt:true
      },
      orderBy:[{module:"asc"},{documentType:"asc"},{effectiveFrom:"desc"}]
    }),
    prisma.appParameter.findMany({orderBy:[{scope:"asc"},{key:"asc"}]}),
    prisma.alertRule.findMany({orderBy:[{module:"asc"},{kind:"asc"},{key:"asc"}]}),
    prisma.configurationChange.findMany({orderBy:{createdAt:"desc"},take:80}),
  ]);
  return {departments,catalogs,forms,templates,parameters,alertRules,history};
}

function day(value:Date){return new Date(Date.UTC(value.getUTCFullYear(),value.getUTCMonth(),value.getUTCDate()));}
function addDays(value:Date,days:number){const d=day(value);d.setUTCDate(d.getUTCDate()+days);return d;}
function dueState(due:Date,today:Date){return due<today?"OVERDUE":"UPCOMING";}

export type AlertPreviewItem={
  key:string;
  ruleKey:string;
  module:QmsRecordType;
  businessCode:string;
  label:string;
  dueDate:Date;
  state:"OVERDUE"|"UPCOMING";
  href:string;
  detail:string;
};

export type AlertPreviewScope = { year?: number | null; department?: string; module?: QmsRecordType | "PNT" | "ALL" };

export async function getAlertPreview(referenceDate = new Date(), scope?: AlertPreviewScope) {
  const rules = await prisma.alertRule.findMany({ where: { isActive: true }, orderBy: [{ severity: "desc" }, { module: "asc" }] });
  const today = day(referenceDate);
  const horizon = addDays(today, Math.max(...rules.map(r => r.leadDays), 0));
  const items: AlertPreviewItem[] = [];
  const sources = [
    { key: "CAPA_FOLLOWUP_DUE", module: "CAPA", table: "Capa", child: "CapaFollowup", parent: "capaId", order: '"sequenceNumber" DESC', detail: 'COALESCE(f.description, f.observations)', status: "status", label: "Seguimiento CAPA", prefix: "CAPA-F-", route: "capa", tab: "?tab=followups" },
    { key: "CHANGE_FOLLOWUP_DUE", module: "CHANGE_CONTROL", table: "ChangeControl", child: "ChangeControlFollowup", parent: "changeControlId", order: '"sequenceNumber" DESC', detail: 'f."remainOpenReason"', status: "finalStatus", label: "Seguimiento de cambio", prefix: "CC-F-", route: "changes", tab: "?tab=followups" },
    { key: "COMPLAINT_FOLLOWUP_DUE", module: "COMPLAINT", table: "Complaint", child: "ComplaintFollowup", parent: "complaintId", order: '"followupDate" DESC, "createdAt" DESC', detail: "f.comment", status: "status", label: "Seguimiento de reclamación", prefix: "REC-F-", route: "complaints", tab: "?tab=followups" },
    { key: "RETURN_FOLLOWUP_DUE", module: "RETURN", table: "ReturnRecord", child: "ReturnFollowup", parent: "returnRecordId", order: '"followupDate" DESC, "createdAt" DESC', detail: "f.comment", status: "status", label: "Seguimiento de devolución", prefix: "RET-F-", route: "returns", tab: "?tab=followups" },
  ] as const;
  const restriction = () => Prisma.sql`
    ${scope ? Prisma.sql`AND q."isActive" = true` : Prisma.empty}
    ${scope?.year ? Prisma.sql`AND q.year = ${scope.year}` : Prisma.empty}
    ${scope?.department ? Prisma.sql`AND r."departmentId" = ${scope.department}` : Prisma.empty}
  `;
  const included = (module: QmsRecordType) => !scope?.module || scope.module === "ALL" || scope.module === module;
  for (const source of sources) {
    const rule = rules.find(r => r.key === source.key);
    if (!rule || !included(source.module)) continue;
    const rows = await prisma.$queryRaw<Array<{ id: string; businessCode: string | null; due: Date; detail: string | null }>>(Prisma.sql`
      SELECT r.id, q."businessCode", f."nextFollowupDate" AS due, f.detail
      FROM ${Prisma.raw('"' + source.table + '"')} r JOIN "QmsRecord" q ON q.id = r."qmsRecordId"
      JOIN LATERAL (SELECT f."nextFollowupDate", ${Prisma.raw(source.detail)} AS detail FROM ${Prisma.raw('"' + source.child + '"')} f
        WHERE f.${Prisma.raw('"' + source.parent + '"')} = r.id ORDER BY ${Prisma.raw(source.order)} LIMIT 1) f ON true
      WHERE r.${Prisma.raw('"' + source.status + '"')}::text IN (${Prisma.join(source.module === "CAPA" ? ["OPEN", "CLOSED"] : ["OPEN"])})
        ${restriction()} AND f."nextFollowupDate" < ${addDays(today, rule.leadDays + 1)}
    `);
    for (const row of rows) items.push({
      key: source.prefix + row.id, ruleKey: rule.key, module: source.module, businessCode: row.businessCode ?? "Sin código",
      label: source.label, dueDate: day(row.due), state: dueState(day(row.due), today),
      href: "/" + source.route + "/" + row.id + source.tab, detail: row.detail ?? "Seguimiento programado",
    });
  }
  const capaEff = rules.find(r => r.key === "CAPA_EFFECTIVENESS_PENDING");
  if (capaEff && included("CAPA")) {
    const rows = await prisma.$queryRaw<Array<{ id: string; businessCode: string | null; due: Date }>>(Prisma.sql`
      SELECT r.id, q."businessCode", r."operationalClosedAt" AS due FROM "Capa" r JOIN "QmsRecord" q ON q.id = r."qmsRecordId"
      WHERE r.status = 'CLOSED' AND r."effectivenessStatus" = 'PENDING' ${restriction()}
        AND r."operationalClosedAt" < ${addDays(horizon, 1 - capaEff.leadDays)}
    `);
    for (const row of rows) {
      const due = addDays(row.due, capaEff.leadDays);
      items.push({ key: "CAPA-E-" + row.id, ruleKey: capaEff.key, module: "CAPA", businessCode: row.businessCode ?? "Sin código",
        label: "Eficacia CAPA pendiente", dueDate: due, state: dueState(due, today),
        href: "/capa/" + row.id + "?tab=effectiveness", detail: "CAPA cerrada operativamente con eficacia pendiente" });
    }
  }
  const changeExec = rules.find(r => r.key === "CHANGE_PLANNED_EXECUTION_DUE");
  if (changeExec && included("CHANGE_CONTROL")) {
    const rows = await prisma.$queryRaw<Array<{ id: string; businessCode: string | null; due: Date }>>(Prisma.sql`
      SELECT r.id, q."businessCode", r."plannedImplementationDate" AS due FROM "ChangeControl" r JOIN "QmsRecord" q ON q.id = r."qmsRecordId"
      WHERE r."finalStatus" = 'OPEN' AND r."executionStatus" = 'NOT_EXECUTED' ${restriction()}
        AND r."plannedImplementationDate" < ${addDays(today, changeExec.leadDays + 1)}
    `);
    for (const row of rows) items.push({ key: "CC-E-" + row.id, ruleKey: changeExec.key, module: "CHANGE_CONTROL", businessCode: row.businessCode ?? "Sin código",
      label: "Ejecución de cambio", dueDate: day(row.due), state: dueState(day(row.due), today),
      href: "/changes/" + row.id, detail: "Fecha prevista de ejecución próxima o vencida" });
  }
  // Preserve the previous stable rule-group order when the public preview comparator ties.
  const groupOrder = ["CAPA_FOLLOWUP_DUE", "CAPA_EFFECTIVENESS_PENDING", "CHANGE_FOLLOWUP_DUE", "CHANGE_PLANNED_EXECUTION_DUE", "COMPLAINT_FOLLOWUP_DUE", "RETURN_FOLLOWUP_DUE"];
  items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.businessCode.localeCompare(b.businessCode) || groupOrder.indexOf(a.ruleKey) - groupOrder.indexOf(b.ruleKey));
  return { rules, items };
}
