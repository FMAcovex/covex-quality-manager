import { Prisma } from "@prisma/client";
import { reviewListWhere } from "@/lib/qms/review/list-domain";
import { validValues, validYears } from "@/lib/qms/list-filters";
import type { ComplaintOperationalSituation } from "@/modules/complaints/domain";

export type ComplaintListFilters={
  page?:string;
  recurrent?:string;
  capa?:string;
  returns?:string;
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

/** `lotIds`: reclamaciones cuyos otros lotes (D-094) coinciden con `q`, resueltas antes en SQL. */
export function complaintListWhere(filters:ComplaintListFilters,now=new Date(),lotIds:string[]=[]):Prisma.ComplaintWhereInput{
 const and:Prisma.ComplaintWhereInput[]=[];
  const reviewWhere = reviewListWhere(filters.review);
  if (reviewWhere) and.push({ qmsRecord: reviewWhere });
 if(filters.administrative==="ANNULLED")and.push({qmsRecord:{isActive:false}});
 else if(filters.administrative!=="ALL")and.push({qmsRecord:{isActive:true}});
 if(filters.q)and.push({OR:[
  ...(lotIds.length?[{id:{in:lotIds}}]:[]),
  {qmsRecord:{businessCode:{contains:filters.q,mode:"insensitive"}}},
  {qmsRecord:{annulledBusinessCode:{contains:filters.q,mode:"insensitive"}}},
  {partyName:{contains:filters.q,mode:"insensitive"}},{reference:{contains:filters.q,mode:"insensitive"}},
  {lotReference:{contains:filters.q,mode:"insensitive"}},{description:{contains:filters.q,mode:"insensitive"}},
  {rootCause:{contains:filters.q,mode:"insensitive"}},{internalObservations:{contains:filters.q,mode:"insensitive"}},
  {capaPlans:{some:{description:{contains:filters.q,mode:"insensitive"}}}},
  {derivedActions:{some:{description:{contains:filters.q,mode:"insensitive"}}}},
  {qmsRecord:{sourceRelations:{some:{isActive:true,targetRecord:{businessCode:{contains:filters.q,mode:"insensitive"}}}}}}
 ]});
 const yearsFilter=validYears(filters.year);if(yearsFilter.length)and.push({qmsRecord:{year:{in:yearsFilter}}});
 if(filters.department?.length)and.push({departmentId:{in:filters.department}});
 const types=validValues(filters.type,["PROVIDER","CUSTOMER"] as const);if(types.length)and.push({complaintType:{in:types as ("PROVIDER"|"CUSTOMER")[]}});
 const statuses=validValues(filters.status,["DRAFT","OPEN","CLOSED"] as const);if(statuses.length)and.push({status:{in:statuses as ("DRAFT"|"OPEN"|"CLOSED")[]}});
 const classifications=validValues(filters.classification,["CRITICAL","MAJOR","MINOR","NO_GMP_IMPACT"] as const);if(classifications.length)and.push({classification:{in:classifications as ("CRITICAL"|"MAJOR"|"MINOR"|"NO_GMP_IMPACT")[]}});
 const effectiveness=validValues(filters.effectiveness,["PENDING","ACCEPTABLE","NOT_ACCEPTABLE","NOT_REQUIRED"] as const);if(effectiveness.length)and.push({effectivenessStatus:{in:effectiveness as ("PENDING"|"ACCEPTABLE"|"NOT_ACCEPTABLE"|"NOT_REQUIRED")[]}});
 const today=new Date(now);today.setUTCHours(0,0,0,0);
 const situationWhere:Record<ComplaintOperationalSituation,Prisma.ComplaintWhereInput>={
  DRAFT:{status:"DRAFT"},CLOSED:{status:"CLOSED"},
  PART_I:{status:"OPEN",partIIRequired:null,OR:[{conclusion:null},{conclusion:""}]},
  PART_II_DECISION_PENDING:{status:"OPEN",partIIRequired:null,AND:[{conclusion:{not:null}},{conclusion:{not:""}}]},
  PART_I_CLOSURE_PENDING:{status:"OPEN",partIIRequired:false},
  PART_II:{status:"OPEN",partIIRequired:true,OR:[{responseSummary:null},{responseSummary:""},{effectivenessStatus:{in:["ACCEPTABLE","NOT_REQUIRED"]}}]},
  EFFECTIVENESS_PENDING:{status:"OPEN",partIIRequired:true,effectivenessStatus:"PENDING",AND:[{responseSummary:{not:null}},{responseSummary:{not:""}}]},
  EFFECTIVENESS_NONCONFORMING:{status:"OPEN",partIIRequired:true,effectivenessStatus:"NOT_ACCEPTABLE",AND:[{responseSummary:{not:null}},{responseSummary:{not:""}}]},
 };
 const situations=validValues(filters.situation,situationValues);
 if(situations.length)and.push({OR:situations.map(x=>situationWhere[x as ComplaintOperationalSituation])});
 const followups=validValues(filters.followup,followupValues);
 if(followups.length)and.push({status:"OPEN",OR:followups.map(x=>x==="MISSING"?{nextFollowupDate:null}:x==="OVERDUE"?{nextFollowupDate:{lt:today}}:{nextFollowupDate:{gte:today}})});
 if(filters.recurrent==="YES"||filters.recurrent==="NO")and.push({recurrent:filters.recurrent==="YES"});
 for(const [key,type] of [["capa","CAPA"],["returns","RETURN"]] as const){
  if(filters[key]==="YES"||filters[key]==="NO"){
   const relation={isActive:true,relationType:"GENERATES" as const,targetRecord:{recordType:type}};
   and.push({qmsRecord:{sourceRelations:filters[key]==="YES"?{some:relation}:{none:relation}}});
  }
 }
 return and.length?{AND:and}:{};
}
