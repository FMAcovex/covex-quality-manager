import { createHash } from "node:crypto";
import { Prisma,QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readXlsxSheet } from "@/modules/deviations/import/xlsx-reader";
import { mapHistoricalCapaRows,type HistoricalCapaRow } from "@/modules/capa/import/legacy-mapping";

function hash(buffer:Buffer){return createHash("sha256").update(buffer).digest("hex");}
function blocking(row:HistoricalCapaRow){
  return row.issues.filter((x)=>["MISSING_OR_INVALID_OPENING_DATE","MISSING_DEPARTMENT","MISSING_DESCRIPTION","DUPLICATE_CODE_IN_SOURCE"].includes(x));
}
function snapshot(row:HistoricalCapaRow):Prisma.InputJsonObject {
  return {sheet:row.sourceSheet,row:row.sourceRow,raw:row.raw as Prisma.InputJsonObject,issues:row.issues};
}

export async function analyzeHistoricalCapaImport(buffer:Buffer,sourceFileName:string){
  const mapped=mapHistoricalCapaRows(
    readXlsxSheet(buffer,"2025"),
    readXlsxSheet(buffer,"2026"),
    readXlsxSheet(buffer,"Base_KPI"),
  );
  const codes=mapped.map((r)=>r.businessCode).filter((v):v is string=>Boolean(v));
  const existing=await prisma.qmsRecord.findMany({
    where:{recordType:"CAPA",businessCode:{in:codes}},select:{id:true,businessCode:true},
  });
  const existingMap=new Map(existing.map((x)=>[x.businessCode!,x.id]));
  const rows=mapped.map((r)=>{
    const result=blocking(r).length?"REJECTED":r.businessCode&&existingMap.has(r.businessCode)?"SKIPPED_DUPLICATE":"REVIEW_REQUIRED";
    return {sourceSheet:r.sourceSheet,sourceRow:r.sourceRow,businessCode:r.businessCode,result,issues:r.issues};
  });
  return {
    mapped,existingMap,
    report:{
      mode:"dry-run" as const,sourceFileName,sourceSha256:hash(buffer),years:[2025,2026],
      generatedAt:new Date().toISOString(),
      counts:{
        total:rows.length,reviewRequired:rows.filter((r)=>r.result==="REVIEW_REQUIRED").length,
        duplicates:rows.filter((r)=>r.result==="SKIPPED_DUPLICATE").length,
        rejected:rows.filter((r)=>r.result==="REJECTED").length,imported:0,
      },rows,
    },
  };
}

export async function applyHistoricalCapaImport(buffer:Buffer,sourceFileName:string,actor:string) {
  const a=await analyzeHistoricalCapaImport(buffer,sourceFileName);
  const byKey=new Map(a.mapped.map((r)=>[`${r.sourceSheet}:${r.sourceRow}`,r]));
  const batch=await prisma.historicalImportBatch.create({
    data:{
      recordType:QmsRecordType.CAPA,sourceFileName,sourceSha256:a.report.sourceSha256,years:[2025,2026],
      importedByText:actor,totalRows:a.report.counts.total,duplicateRows:a.report.counts.duplicates,
      rejectedRows:a.report.counts.rejected,reviewRows:a.report.counts.reviewRequired,
      report:a.report as unknown as Prisma.InputJsonValue,
    },
  });
  let imported=0;
  for(const rr of a.report.rows){
    const row=byKey.get(`${rr.sourceSheet}:${rr.sourceRow}`)!;
    if(rr.result==="REJECTED"||rr.result==="SKIPPED_DUPLICATE"){
      await prisma.historicalImportRow.create({data:{
        batchId:batch.id,qmsRecordId:row.businessCode?a.existingMap.get(row.businessCode):undefined,
        sourceSheet:row.sourceSheet,sourceRow:row.sourceRow,businessCode:row.businessCode,
        result:rr.result==="REJECTED"?"REJECTED":"SKIPPED_DUPLICATE",
        issues:row.issues,sourceSnapshot:snapshot(row),
      }});
      continue;
    }
    await prisma.$transaction(async(tx)=>{
      let department=await tx.department.findUnique({where:{code:row.departmentCode!}});
      if(!department)department=await tx.department.create({data:{code:row.departmentCode!,name:row.departmentName??row.departmentCode!}});
      const qms=await tx.qmsRecord.create({data:{recordType:"CAPA",businessCode:row.businessCode,year:row.year}});
      const capa=await tx.capa.create({data:{
        qmsRecordId:qms.id,actionType:row.actionType,departmentId:department.id,
        departmentCodeSnapshot:row.departmentCode,departmentNameSnapshot:row.departmentName??department.name,
        openedAt:row.openedAt,createdByText:"Importación histórica",originType:row.normalizedOrigin??row.originType,
        originCode:row.originCode,defectDescription:row.description,rootCause:null,
        operationalClosedAt:row.operationalClosedAt,status:row.status,effectivenessStatus:row.effectivenessStatus,
        effectiveClosedAt:row.effectiveClosedAt,internalObservations:row.observations,
        signedDocumentAvailable:row.signedDocumentAvailable,dataQualityStatus:"REVIEW_REQUIRED",
        extraData:{historicalImport:{sourceFileName,sourceSha256:a.report.sourceSha256,sourceSheet:row.sourceSheet,sourceRow:row.sourceRow,originOriginal:row.originType,normalizedOrigin:row.normalizedOrigin,followupSummary:row.followupSummary,issues:row.issues,raw:row.raw}},
        plannedActions:{create:[{description:row.description!,plannedExecutionDate:row.plannedAt,sortOrder:0}]},
      }});
      if(row.followupSummary&&row.followupDate&&row.followupSequence!==null){
        await tx.capaFollowup.create({data:{
          capaId:capa.id,sequenceNumber:row.followupSequence,followupDate:row.followupDate,
          completedByText:"Importación histórica",description:row.followupSummary,
          nextFollowupDate:row.nextFollowupDate,
        }});
      }
      await tx.changeHistory.create({data:{
        qmsRecordId:qms.id,changedByText:actor,fieldPath:"__historical_import__",
        newValue:snapshot(row),reason:`Importación histórica desde ${sourceFileName} · ${row.sourceSheet} fila ${row.sourceRow}`,source:"IMPORT",
      }});
      await tx.historicalImportRow.create({data:{
        batchId:batch.id,qmsRecordId:qms.id,sourceSheet:row.sourceSheet,sourceRow:row.sourceRow,
        businessCode:row.businessCode,result:"REVIEW_REQUIRED",issues:row.issues,sourceSnapshot:snapshot(row),
      }});
    });
    imported++;
  }
  const report={...a.report,mode:"apply" as const,batchId:batch.id,counts:{...a.report.counts,imported}};
  await prisma.historicalImportBatch.update({where:{id:batch.id},data:{appliedAt:new Date(),importedRows:imported,report:report as unknown as Prisma.InputJsonValue}});
  return report;
}
