import { reviewListWhere } from "@/lib/qms/review/list-domain";
import { withActiveReviewCounts } from "@/lib/qms/review/list-queries";
import "server-only";
import { Prisma, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validValues, validYears } from "@/lib/qms/list-filters";
import {
  complaintFollowupState,
  complaintOperationalSituation,
  type ComplaintOperationalSituation,
} from "@/modules/complaints/domain";

export type ComplaintListFilters={
  review?: string;
  q?:string;
  administrative?:string;
  year?:string[];
  department?:string[];
  type?:string[];
  status?:string[];
  classification?:string[];
  effectiveness?:string[];
  situation?:string[];
  followup?:string[];
};

const situationValues:ComplaintOperationalSituation[]=[
  "DRAFT","PART_I","PART_II_DECISION_PENDING","PART_I_CLOSURE_PENDING",
  "PART_II","EFFECTIVENESS_PENDING","EFFECTIVENESS_NONCONFORMING","CLOSED"
];
const followupValues=["OVERDUE","PENDING","MISSING"] as const;

export async function getComplaintList(filters:ComplaintListFilters){
 const and:Prisma.ComplaintWhereInput[]=[];
  const reviewWhere = reviewListWhere(filters.review);
  if (reviewWhere) and.push({ qmsRecord: reviewWhere });
 if(filters.administrative==="ANNULLED")and.push({qmsRecord:{isActive:false}});
 else if(filters.administrative!=="ALL")and.push({qmsRecord:{isActive:true}});
 if(filters.q)and.push({OR:[
  {qmsRecord:{businessCode:{contains:filters.q,mode:"insensitive"}}},
  {qmsRecord:{annulledBusinessCode:{contains:filters.q,mode:"insensitive"}}},
  {partyName:{contains:filters.q,mode:"insensitive"}},{reference:{contains:filters.q,mode:"insensitive"}},
  {lotReference:{contains:filters.q,mode:"insensitive"}},{description:{contains:filters.q,mode:"insensitive"}},
  {rootCause:{contains:filters.q,mode:"insensitive"}},{internalObservations:{contains:filters.q,mode:"insensitive"}},
  {capaPlans:{some:{description:{contains:filters.q,mode:"insensitive"}}}},
  {derivedActions:{some:{description:{contains:filters.q,mode:"insensitive"}}}}
 ]});
 const yearsFilter=validYears(filters.year);if(yearsFilter.length)and.push({qmsRecord:{year:{in:yearsFilter}}});
 if(filters.department?.length)and.push({departmentId:{in:filters.department}});
 const types=validValues(filters.type,["PROVIDER","CUSTOMER"] as const);if(types.length)and.push({complaintType:{in:types as ("PROVIDER"|"CUSTOMER")[]}});
 const statuses=validValues(filters.status,["DRAFT","OPEN","CLOSED"] as const);if(statuses.length)and.push({status:{in:statuses as ("DRAFT"|"OPEN"|"CLOSED")[]}});
 const classifications=validValues(filters.classification,["CRITICAL","MAJOR","MINOR","NO_GMP_IMPACT"] as const);if(classifications.length)and.push({classification:{in:classifications as ("CRITICAL"|"MAJOR"|"MINOR"|"NO_GMP_IMPACT")[]}});
 const effectiveness=validValues(filters.effectiveness,["PENDING","ACCEPTABLE","NOT_ACCEPTABLE","NOT_REQUIRED"] as const);if(effectiveness.length)and.push({effectivenessStatus:{in:effectiveness as ("PENDING"|"ACCEPTABLE"|"NOT_ACCEPTABLE"|"NOT_REQUIRED")[]}});
 const where:Prisma.ComplaintWhereInput=and.length?{AND:and}:{};
 const administrativeWhere:Prisma.ComplaintWhereInput=filters.administrative==="ANNULLED"?{qmsRecord:{isActive:false}}:filters.administrative==="ALL"?{}:{qmsRecord:{isActive:true}};
 const today=new Date();today.setHours(0,0,0,0);

 const [baseRows,departments,years,total,drafts,open,pendingPartII,pendingEfficacy,followupDue]=await Promise.all([
  prisma.complaint.findMany({
   where,
   include:{
    qmsRecord:{include:{
      sourceRelations:{where:{isActive:true},include:{targetRecord:true}},
      targetRelations:{where:{isActive:true},include:{sourceRecord:true}},
      versions:{orderBy:{sequenceNumber:"desc"},take:1,select:{sequenceNumber:true}}
    }},
    department:true,capaPlans:true
   },
   orderBy:[{status:"asc"},{openedAt:"desc"},{createdAt:"desc"}],
   take:300
  }),
  prisma.department.findMany({where:{isActive:true},orderBy:{code:"asc"}}),
  prisma.qmsRecord.findMany({where:{recordType:QmsRecordType.COMPLAINT,year:{not:null}},select:{year:true},distinct:["year"],orderBy:{year:"desc"}}),
  prisma.complaint.count({where:{AND:[administrativeWhere,{status:{not:"DRAFT"}}]}}),
  prisma.complaint.count({where:{AND:[administrativeWhere,{status:"DRAFT"}]}}),
  prisma.complaint.count({where:{AND:[administrativeWhere,{status:"OPEN"}]}}),
  prisma.complaint.count({where:{AND:[administrativeWhere,{status:"OPEN",partIIRequired:null,conclusion:{not:null}}]}}),
  prisma.complaint.count({where:{AND:[administrativeWhere,{status:"OPEN",partIIRequired:true,effectivenessStatus:"PENDING"}]}}),
  prisma.complaint.count({where:{AND:[administrativeWhere,{status:"OPEN",nextFollowupDate:{lt:today}}]}})
 ]);

 const selectedSituations=(filters.situation??[]).filter((x):x is ComplaintOperationalSituation=>situationValues.includes(x as ComplaintOperationalSituation));
 const selectedFollowups=(filters.followup??[]).filter((x):x is typeof followupValues[number]=>followupValues.includes(x as typeof followupValues[number]));
 const rows=baseRows.filter(row=>{
   if(selectedSituations.length&&!selectedSituations.includes(complaintOperationalSituation(row)))return false;
   const followupState=complaintFollowupState(row,today);
   if(selectedFollowups.length&&(followupState==="NONE"||!selectedFollowups.includes(followupState)))return false;
   return true;
 });

 return {rows: await withActiveReviewCounts(rows),departments,years:years.map(x=>x.year).filter((x):x is number=>x!==null),counters:{
  total,drafts,open,pendingPartII,pendingEfficacy,followupDue
 }};
}

export async function getComplaintDetail(id:string){
 return prisma.complaint.findUnique({where:{id},include:{
  qmsRecord:{include:{
    sourceRelations:{where:{isActive:true},include:{targetRecord:true}},
    targetRelations:{where:{isActive:true},include:{sourceRecord:true}},
    history:{orderBy:{changedAt:"desc"},take:100},
    versions:{orderBy:{sequenceNumber:"asc"},include:{documents:{orderBy:{uploadedAt:"desc"}}}},
    generatedDocuments:{orderBy:{generatedAt:"desc"}}
  }},
  department:true,followups:{orderBy:[{followupDate:"desc"},{createdAt:"desc"}]},
  capaPlans:{orderBy:{createdAt:"asc"},include:{linkedCapaRecord:{include:{capa:true}}}},
  derivedActions:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},
  formVersion:true,annexIIITemplateVersion:true,annexIVTemplateVersion:true,annexVTemplateVersion:true
 }});
}

export async function getComplaintLookups(){
 const [departments,forms,templates]=await Promise.all([
  prisma.department.findMany({where:{isActive:true},orderBy:{code:"asc"}}),
  prisma.formVersion.findMany({where:{module:"COMPLAINT",isActive:true},orderBy:{effectiveFrom:"desc"}}),
  prisma.templateVersion.findMany({where:{module:"COMPLAINT",isActive:true},orderBy:{effectiveFrom:"desc"}})
 ]);
 return {departments,forms,templates};
}
