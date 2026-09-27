import "server-only";
import { Prisma, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ChangeControlListFilters = {
  q?: string;
  year?: string;
  department?: string;
  classification?: string;
  status?: string;
  execution?: string;
  effectiveness?: string;
  followup?: string;
};

export async function getChangeControlList(filters:ChangeControlListFilters) {
  const and:Prisma.ChangeControlWhereInput[]=[];
  if(filters.q) {
    and.push({OR:[
      {qmsRecord:{businessCode:{contains:filters.q,mode:"insensitive"}}},
      {description:{contains:filters.q,mode:"insensitive"}},
      {justification:{contains:filters.q,mode:"insensitive"}},
      {evaluation:{contains:filters.q,mode:"insensitive"}},
      {internalObservations:{contains:filters.q,mode:"insensitive"}},
      {actions:{some:{description:{contains:filters.q,mode:"insensitive"}}}},
    ]});
  }
  if(filters.year&&/^\d{4}$/.test(filters.year)) and.push({qmsRecord:{year:Number(filters.year)}});
  if(filters.department) and.push({departmentId:filters.department});
  if(filters.classification==="MAJOR"||filters.classification==="MINOR") and.push({classification:filters.classification});
  if(["OPEN","CLOSED","REJECTED","CANCELLED"].includes(filters.status??"")) {
    and.push({status:filters.status as "OPEN"|"CLOSED"|"REJECTED"|"CANCELLED"});
  }
  if(filters.execution==="EXECUTED"||filters.execution==="NOT_EXECUTED") and.push({executionStatus:filters.execution});
  if(["PENDING","ACCEPTABLE","NOT_ACCEPTABLE"].includes(filters.effectiveness??"")) {
    and.push({effectivenessStatus:filters.effectiveness as "PENDING"|"ACCEPTABLE"|"NOT_ACCEPTABLE"});
  }
  const where:Prisma.ChangeControlWhereInput=and.length?{AND:and}:{};
  const now=new Date();
  const [rows,departments,years,total,open,pendingExecution,executedPendingClosure,followupRows]=await Promise.all([
    prisma.changeControl.findMany({
      where,
      include:{
        qmsRecord:true,
        department:true,
        actions:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},
        followups:{orderBy:[{sequenceNumber:"desc"},{followupDate:"desc"}]},
      },
      orderBy:[{status:"asc"},{requestedAt:"desc"},{createdAt:"desc"}],
      take:400,
    }),
    prisma.department.findMany({where:{isActive:true},orderBy:{code:"asc"}}),
    prisma.qmsRecord.findMany({where:{recordType:QmsRecordType.CHANGE_CONTROL,year:{not:null}},select:{year:true},distinct:["year"],orderBy:{year:"desc"}}),
    prisma.changeControl.count(),
    prisma.changeControl.count({where:{status:"OPEN"}}),
    prisma.changeControl.count({where:{status:"OPEN",executionStatus:"NOT_EXECUTED",decisionResult:"APPROVED"}}),
    prisma.changeControl.count({where:{status:"OPEN",executionStatus:"EXECUTED"}}),
    prisma.changeControl.findMany({
      where:{status:"OPEN"},
      select:{followups:{orderBy:[{sequenceNumber:"desc"},{followupDate:"desc"}],take:1,select:{nextFollowupDate:true}}},
    }),
  ]);
  return {
    rows:rows.filter((row)=>{
      if(!filters.followup) return true;
      const next=row.followups[0]?.nextFollowupDate;
      if(filters.followup==="due") return Boolean(next&&next<=now);
      if(filters.followup==="scheduled") return Boolean(next&&next>now);
      if(filters.followup==="none") return !next;
      return true;
    }),
    departments,
    years:years.map((r)=>r.year).filter((v):v is number=>v!==null),
    counters:{
      total,open,pendingExecution,executedPendingClosure,
      overdueFollowups:followupRows.filter((r)=>{
        const next=r.followups[0]?.nextFollowupDate;
        return Boolean(next&&next<=now);
      }).length,
    },
  };
}

export async function getChangeControlDetail(id:string) {
  return prisma.changeControl.findUnique({
    where:{id},
    include:{
      qmsRecord:{
        include:{
          sourceRelations:{where:{isActive:true},include:{targetRecord:true}},
          targetRelations:{where:{isActive:true},include:{sourceRecord:true}},
          history:{orderBy:{changedAt:"desc"},take:100},
          versions:{orderBy:{sequenceNumber:"asc"}},
          generatedDocuments:{orderBy:{generatedAt:"desc"}},
        },
      },
      department:true,
      actions:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},
      followups:{orderBy:[{sequenceNumber:"desc"},{followupDate:"desc"}]},
      formVersion:true,
      requestDecisionTemplateVersion:true,
      followupTemplateVersion:true,
    },
  });
}

export async function getChangeControlLookups() {
  const [departments,formVersions,requestTemplates,followupTemplates]=await Promise.all([
    prisma.department.findMany({where:{isActive:true},orderBy:{code:"asc"}}),
    prisma.formVersion.findMany({where:{module:"CHANGE_CONTROL",isActive:true},orderBy:{effectiveFrom:"desc"}}),
    prisma.templateVersion.findMany({where:{module:"CHANGE_CONTROL",documentType:"CHANGE_ANNEX_III_IV",isActive:true},orderBy:{effectiveFrom:"desc"}}),
    prisma.templateVersion.findMany({where:{module:"CHANGE_CONTROL",documentType:"CHANGE_ANNEX_V",isActive:true},orderBy:{effectiveFrom:"desc"}}),
  ]);
  return {departments,formVersions,requestTemplates,followupTemplates};
}
