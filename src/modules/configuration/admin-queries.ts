import "server-only";
import { QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";

export function moduleLabel(module:QmsRecordType){
  return ({
    DEVIATION:"Desviaciones",
    AUDIT:"Auditorías",
    CAPA:"CAPA",
    CHANGE_CONTROL:"Controles de Cambios",
    COMPLAINT:"Reclamaciones",
    RETURN:"Devoluciones",
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

export async function getAlertPreview(referenceDate=new Date()){
  const rules=await prisma.alertRule.findMany({where:{isActive:true},orderBy:[{severity:"desc"},{module:"asc"}]});
  if(!rules.length)return {rules,items:[] as AlertPreviewItem[]};
  const today=day(referenceDate);
  const maxLead=Math.max(...rules.map(r=>r.leadDays),0);
  const horizon=addDays(today,maxLead);
  const items:AlertPreviewItem[]=[];

  const rule=(key:string)=>rules.find(r=>r.key===key);

  const capaFollow=rule("CAPA_FOLLOWUP_DUE");
  if(capaFollow){
    const rows=await prisma.capa.findMany({
      where:{status:{in:["OPEN","CLOSED"]}},
      include:{qmsRecord:true,followups:{orderBy:[{sequenceNumber:"desc"}],take:1}},
    });
    for(const r of rows){
      const due=r.followups[0]?.nextFollowupDate;
      if(!due)continue;
      const limit=addDays(today,capaFollow.leadDays);
      if(day(due)<=limit)items.push({key:`CAPA-F-${r.id}`,ruleKey:capaFollow.key,module:"CAPA",businessCode:r.qmsRecord.businessCode??"Sin código",label:"Seguimiento CAPA",dueDate:day(due),state:dueState(day(due),today),href:`/capa/${r.id}?tab=followups`,detail:r.followups[0]?.description??r.followups[0]?.observations??"Seguimiento programado"});
    }
  }

  const capaEff=rule("CAPA_EFFECTIVENESS_PENDING");
  if(capaEff){
    const rows=await prisma.capa.findMany({where:{status:"CLOSED",effectivenessStatus:"PENDING",operationalClosedAt:{not:null}},include:{qmsRecord:true}});
    for(const r of rows){
      if(!r.operationalClosedAt)continue;
      const due=addDays(r.operationalClosedAt,capaEff.leadDays);
      if(due<=horizon)items.push({key:`CAPA-E-${r.id}`,ruleKey:capaEff.key,module:"CAPA",businessCode:r.qmsRecord.businessCode??"Sin código",label:"Eficacia CAPA pendiente",dueDate:due,state:dueState(due,today),href:`/capa/${r.id}?tab=effectiveness`,detail:"CAPA cerrada operativamente con eficacia pendiente"});
    }
  }

  const changeFollow=rule("CHANGE_FOLLOWUP_DUE");
  if(changeFollow){
    const rows=await prisma.changeControl.findMany({where:{finalStatus:"OPEN"},include:{qmsRecord:true,followups:{orderBy:{sequenceNumber:"desc"},take:1}}});
    for(const r of rows){
      const due=r.followups[0]?.nextFollowupDate;
      if(!due)continue;
      if(day(due)<=addDays(today,changeFollow.leadDays))items.push({key:`CC-F-${r.id}`,ruleKey:changeFollow.key,module:"CHANGE_CONTROL",businessCode:r.qmsRecord.businessCode??"Sin código",label:"Seguimiento de cambio",dueDate:day(due),state:dueState(day(due),today),href:`/changes/${r.id}?tab=followups`,detail:r.followups[0]?.remainOpenReason??"Seguimiento programado"});
    }
  }

  const changeExec=rule("CHANGE_PLANNED_EXECUTION_DUE");
  if(changeExec){
    const rows=await prisma.changeControl.findMany({where:{finalStatus:"OPEN",executionStatus:"NOT_EXECUTED",plannedImplementationDate:{not:null}},include:{qmsRecord:true}});
    for(const r of rows){
      if(!r.plannedImplementationDate)continue;
      const due=day(r.plannedImplementationDate);
      if(due<=addDays(today,changeExec.leadDays))items.push({key:`CC-E-${r.id}`,ruleKey:changeExec.key,module:"CHANGE_CONTROL",businessCode:r.qmsRecord.businessCode??"Sin código",label:"Ejecución de cambio",dueDate:due,state:dueState(due,today),href:`/changes/${r.id}`,detail:"Fecha prevista de ejecución próxima o vencida"});
    }
  }

  const complaintFollow=rule("COMPLAINT_FOLLOWUP_DUE");
  if(complaintFollow){
    const rows=await prisma.complaint.findMany({where:{status:"OPEN"},include:{qmsRecord:true,followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}],take:1}}});
    for(const r of rows){
      const due=r.followups[0]?.nextFollowupDate;
      if(!due)continue;
      if(day(due)<=addDays(today,complaintFollow.leadDays))items.push({key:`REC-F-${r.id}`,ruleKey:complaintFollow.key,module:"COMPLAINT",businessCode:r.qmsRecord.businessCode??"Sin código",label:"Seguimiento de reclamación",dueDate:day(due),state:dueState(day(due),today),href:`/complaints/${r.id}?tab=followups`,detail:r.followups[0]?.comment??"Seguimiento programado"});
    }
  }

  const returnFollow=rule("RETURN_FOLLOWUP_DUE");
  if(returnFollow){
    const rows=await prisma.returnRecord.findMany({where:{status:"OPEN"},include:{qmsRecord:true,followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}],take:1}}});
    for(const r of rows){
      const due=r.followups[0]?.nextFollowupDate;
      if(!due)continue;
      if(day(due)<=addDays(today,returnFollow.leadDays))items.push({key:`RET-F-${r.id}`,ruleKey:returnFollow.key,module:"RETURN",businessCode:r.qmsRecord.businessCode??"Sin código",label:"Seguimiento de devolución",dueDate:day(due),state:dueState(day(due),today),href:`/returns/${r.id}?tab=followups`,detail:r.followups[0]?.comment??"Seguimiento programado"});
    }
  }

  items.sort((a,b)=>a.dueDate.getTime()-b.dueDate.getTime()||a.businessCode.localeCompare(b.businessCode));
  return {rules,items};
}
