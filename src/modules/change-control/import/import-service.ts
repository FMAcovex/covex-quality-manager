import { createHash } from "node:crypto";
import { Prisma,QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readXlsxSheet } from "@/modules/deviations/import/xlsx-reader";
import { mapHistoricalChangeRows,type HistoricalChangeRow } from "@/modules/change-control/import/legacy-mapping";
import { serializeChangeControlVersion,snapshotJson } from "@/lib/qms/versioning";
function hash(b:Buffer){return createHash("sha256").update(b).digest("hex");}
function blocking(r:HistoricalChangeRow){return r.issues.filter((x)=>["MISSING_CODE","MISSING_DEPARTMENT","MISSING_DESCRIPTION","MISSING_OR_INVALID_REQUEST_DATE","DUPLICATE_CODE_IN_SOURCE"].includes(x));}
function sourceSnapshot(r:HistoricalChangeRow):Prisma.InputJsonObject{return {sheet:r.sourceSheet,row:r.sourceRow,raw:r.raw as Prisma.InputJsonObject,issues:r.issues};}
export async function analyzeHistoricalChangeImport(buffer:Buffer,sourceFileName:string){
  const mapped=mapHistoricalChangeRows(readXlsxSheet(buffer,"2025"),readXlsxSheet(buffer,"2026"));
  const codes=mapped.map((r)=>r.businessCode).filter((v):v is string=>Boolean(v));
  const existing=await prisma.qmsRecord.findMany({where:{recordType:"CHANGE_CONTROL",businessCode:{in:codes}},select:{id:true,businessCode:true}});
  const existingMap=new Map(existing.map((x)=>[x.businessCode!,x.id]));
  const rows=mapped.map((r)=>({sourceSheet:r.sourceSheet,sourceRow:r.sourceRow,businessCode:r.businessCode,
    result:blocking(r).length?"REJECTED":r.businessCode&&existingMap.has(r.businessCode)?"SKIPPED_DUPLICATE":"REVIEW_REQUIRED",issues:r.issues}));
  return {mapped,existingMap,report:{mode:"dry-run" as const,sourceFileName,sourceSha256:hash(buffer),years:[2025,2026],generatedAt:new Date().toISOString(),
    counts:{total:rows.length,reviewRequired:rows.filter((r)=>r.result==="REVIEW_REQUIRED").length,duplicates:rows.filter((r)=>r.result==="SKIPPED_DUPLICATE").length,rejected:rows.filter((r)=>r.result==="REJECTED").length,imported:0},rows}};
}
export async function applyHistoricalChangeImport(buffer:Buffer,sourceFileName:string,actor:string){
  const a=await analyzeHistoricalChangeImport(buffer,sourceFileName);const byKey=new Map(a.mapped.map((r)=>[`${r.sourceSheet}:${r.sourceRow}`,r]));
  const batch=await prisma.historicalImportBatch.create({data:{recordType:QmsRecordType.CHANGE_CONTROL,sourceFileName,sourceSha256:a.report.sourceSha256,years:[2025,2026],importedByText:actor,totalRows:a.report.counts.total,duplicateRows:a.report.counts.duplicates,rejectedRows:a.report.counts.rejected,reviewRows:a.report.counts.reviewRequired,report:a.report as unknown as Prisma.InputJsonValue}});
  let imported=0;
  for(const rr of a.report.rows){const row=byKey.get(`${rr.sourceSheet}:${rr.sourceRow}`)!;
    if(rr.result==="REJECTED"||rr.result==="SKIPPED_DUPLICATE"){await prisma.historicalImportRow.create({data:{batchId:batch.id,qmsRecordId:row.businessCode?a.existingMap.get(row.businessCode):undefined,sourceSheet:row.sourceSheet,sourceRow:row.sourceRow,businessCode:row.businessCode,result:rr.result==="REJECTED"?"REJECTED":"SKIPPED_DUPLICATE",issues:row.issues,sourceSnapshot:sourceSnapshot(row)}});continue;}
    await prisma.$transaction(async(tx)=>{
      let department=await tx.department.findUnique({where:{code:row.departmentCode!}});if(!department)department=await tx.department.create({data:{code:row.departmentCode!,name:row.departmentName??row.departmentCode!}});
      const qms=await tx.qmsRecord.create({data:{recordType:"CHANGE_CONTROL",businessCode:row.businessCode,year:row.year}});
      const change=await tx.changeControl.create({data:{
        qmsRecordId:qms.id,departmentId:department.id,departmentCodeSnapshot:row.departmentCode,departmentNameSnapshot:row.departmentName??department.name,
        requestedAt:row.requestedAt,requesterName:"Importación histórica",scopes:["OTHER"],scopeOther:row.scopeText,description:row.description,justification:"No disponible en listado histórico",
        requestStatus:row.requestStatus,requestDecisionAt:row.approvedAt,evaluation:null,classification:row.classification,plannedImplementationAt:row.plannedAt,
        decisionResult:row.requestStatus==="DENIED"?"REJECTED":"APPROVED",decisionAt:row.approvedAt,executionStatus:row.executionStatus,executedAt:row.executedAt,
        operationalClosedAt:row.executedAt,effectivenessStatus:row.effectiveness,effectiveClosedAt:row.closedAt,status:row.status,
        closeWithoutExecution:row.status==="CLOSED"&&row.executionStatus==="NOT_EXECUTED",closureConclusion:row.status==="CLOSED"&&row.executionStatus==="NOT_EXECUTED"?row.observations:null,
        internalObservations:row.observations,signedDocumentAvailable:row.signed,dataQualityStatus:"REVIEW_REQUIRED",
        extraData:{historicalImport:{sourceFileName,sourceSha256:a.report.sourceSha256,sourceSheet:row.sourceSheet,sourceRow:row.sourceRow,issues:row.issues,raw:row.raw}},
        actions:{create:[{description:row.description!,plannedExecutionDate:row.plannedAt,actualExecutionDate:row.executedAt,completed:row.executionStatus==="EXECUTED",sortOrder:0}]},
      }});
      for(const f of row.followups){if(!f.date)continue;await tx.changeControlFollowup.create({data:{changeControlId:change.id,sequenceNumber:f.sequence,followupDate:f.date,responsibleText:"Importación histórica",executionStatus:row.executionStatus,executionDate:row.executedAt,effectivenessStatus:row.effectiveness,nextFollowupDate:f.sequence===row.followups.at(-1)?.sequence?row.nextFollowupAt:null,observations:"Seguimiento recuperado del listado histórico."}});}
      const full=await tx.changeControl.findUniqueOrThrow({where:{id:change.id},include:{qmsRecord:true,actions:true,followups:true,formVersion:true,requestDecisionTemplateVersion:true,followupTemplateVersion:true}});
      await tx.qmsRecordVersion.create({data:{qmsRecordId:qms.id,sequenceNumber:Math.max(0,row.followups.length),kind:"HISTORICAL_STATE",snapshot:snapshotJson(serializeChangeControlVersion(full)),reason:"Baseline histórico importado; no reconstruye estados intermedios no conservados",createdByText:actor,source:"IMPORT"}});
      await tx.changeHistory.create({data:{qmsRecordId:qms.id,changedByText:actor,fieldPath:"__historical_import__",newValue:sourceSnapshot(row),reason:`Importación histórica desde ${sourceFileName} · ${row.sourceSheet} fila ${row.sourceRow}`,source:"IMPORT"}});
      await tx.historicalImportRow.create({data:{batchId:batch.id,qmsRecordId:qms.id,sourceSheet:row.sourceSheet,sourceRow:row.sourceRow,businessCode:row.businessCode,result:"REVIEW_REQUIRED",issues:row.issues,sourceSnapshot:sourceSnapshot(row)}});
    });imported++;
  }
  const report={...a.report,mode:"apply" as const,batchId:batch.id,counts:{...a.report.counts,imported}};
  await prisma.historicalImportBatch.update({where:{id:batch.id},data:{appliedAt:new Date(),importedRows:imported,report:report as unknown as Prisma.InputJsonValue}});return report;
}
