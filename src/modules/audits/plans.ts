import { Prisma, type AuditType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { z } from "zod";

const text = z.string().trim();
const day = z.string().refine(v => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v).toISOString().slice(0,10)===v,"Fecha no válida");
export const planSchema = z.object({year:z.coerce.number().int().min(2000).max(2100),auditType:z.enum(["INTERNAL","EXTERNAL"]),title:text.min(1).max(250),notes:text.max(20000),actor:text.min(1).max(200)});
const programmeEntryFields = {
 plannedPeriodText:text.max(250).optional(), plannedAuditorsText:text.max(2000).optional(),
 productService:text.max(2000).optional(), plannedScope:text.max(2000).optional(),
 plannedModality:z.enum(["ONSITE","REMOTE","HYBRID",""]).optional(), programmeArea:text.max(250).optional(),
};
function programmeEntryData(v:z.infer<typeof entrySchema>) {
 return {...Object.fromEntries(Object.keys(programmeEntryFields).filter(k=>k!=="plannedModality" && v[k as keyof typeof v]!==undefined).map(k=>[k,v[k as keyof typeof v]||null])),
 ...(v.plannedModality!==undefined?{plannedModality:v.plannedModality||null}:{})};
}
export const entrySchema = z.object({...programmeEntryFields,subject:text.min(1).max(20000),targetName:text.max(250),departmentId:z.string().uuid().or(z.literal("")),plannedDate:day,notes:text.max(20000),actor:text.min(1).max(200),reason:text.max(20000)}).refine(v=>!(v.plannedDate && v.plannedPeriodText),"Indica una fecha exacta o un período previsto, no ambos.");
const serialize=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
function requireReason(v:string){if(!v.trim())throw Error("Indica el motivo del cambio.");}
export async function listAnnualPlans() {
  return prisma.auditAnnualPlan.findMany({
    include: {
      entries: {
        include: { audit: { include: { qmsRecord: true } } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: [{ year: "desc" }, { auditType: "asc" }],
  });
}
export async function getAnnualPlan(id:string){return prisma.auditAnnualPlan.findUnique({where:{id},include:{entries:{include:{audit:{include:{qmsRecord:true}},department:true},orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},changes:{orderBy:{createdAt:"desc"},take:100}}});}
export async function createAnnualPlan(input:unknown){const v=planSchema.parse(input);return prisma.$transaction(async tx=>{const duplicate=await tx.auditAnnualPlan.findUnique({where:{year_auditType:{year:v.year,auditType:v.auditType}}});if(duplicate)throw Error("Ya existe un plan de este tipo y año.");const p=await tx.auditAnnualPlan.create({data:{year:v.year,auditType:v.auditType,title:v.title,notes:v.notes||null,createdByText:v.actor}});await tx.auditPlanChange.create({data:{planId:p.id,event:"PLAN_CREATED",actor:v.actor,reason:"Alta del plan anual",newValue:serialize(v)}});return p;});}
export async function addPlanEntry(id:string,input:unknown){const v=entrySchema.parse(input);return prisma.$transaction(async tx=>{const plan=await tx.auditAnnualPlan.findUniqueOrThrow({where:{id}});if(v.departmentId){const dep=await tx.department.findUnique({where:{id:v.departmentId}});if(!dep?.isActive)throw Error("El departamento no está activo.");}const entry=await tx.auditPlanEntry.create({data:{...programmeEntryData(v),planId:id,subject:v.subject,targetName:v.targetName||null,departmentId:v.departmentId||null,plannedDate:v.plannedDate?new Date(v.plannedDate+"T00:00:00.000Z"):null,notes:v.notes||null,createdByText:v.actor}});await tx.auditPlanChange.create({data:{planId:id,entryId:entry.id,event:"ENTRY_ADDED",actor:v.actor,reason:"Incorporación a la planificación",newValue:serialize(v)}});return {entry,plan};});}
export async function updatePlanEntry(planId:string,entryId:string,input:unknown){const v=entrySchema.parse(input);requireReason(v.reason);return prisma.$transaction(async tx=>{const before=await tx.auditPlanEntry.findUniqueOrThrow({where:{id:entryId}});if(before.planId!==planId)throw Error("La entrada no pertenece al plan.");if(v.departmentId){const dep=await tx.department.findUnique({where:{id:v.departmentId}});if(!dep?.isActive&&dep?.id!==before.departmentId)throw Error("Departamento no disponible.");}const after=await tx.auditPlanEntry.update({where:{id:entryId},data:{...programmeEntryData(v),subject:v.subject,targetName:v.targetName||null,departmentId:v.departmentId||null,plannedDate:v.plannedDate?new Date(v.plannedDate+"T00:00:00.000Z"):null,notes:v.notes||null,updatedByText:v.actor}});await tx.auditPlanChange.create({data:{planId,entryId,event:"ENTRY_UPDATED",oldValue:serialize(before),newValue:serialize(after),actor:v.actor,reason:v.reason}});return after;});}
export async function retirePlanEntry(planId:string,entryId:string,actor:string,reason:string){requireReason(reason);return prisma.$transaction(async tx=>{const before=await tx.auditPlanEntry.findUniqueOrThrow({where:{id:entryId},include:{audit:true}});if(before.planId!==planId)throw Error("La entrada no pertenece al plan.");if(before.audit)throw Error("La entrada tiene una auditoría vinculada y no puede retirarse sin reclasificarla.");if(!before.isActive)throw Error("La entrada ya está retirada.");await tx.auditPlanEntry.update({where:{id:entryId},data:{isActive:false,updatedByText:actor}});await tx.auditPlanChange.create({data:{planId,entryId,event:"ENTRY_RETIRED",actor,reason,oldValue:serialize(before)}});});}
export type PlanOption={id:string;year:number;auditType:AuditType;title:string;entries:{id:string;subject:string;plannedDate:Date|null;audit:{id:string}|null}[]};
export async function getPlanOptions():Promise<PlanOption[]>{return prisma.auditAnnualPlan.findMany({select:{id:true,year:true,auditType:true,title:true,entries:{where:{isActive:true},select:{id:true,subject:true,plannedDate:true,audit:{select:{id:true}}},orderBy:{sortOrder:"asc"}}},orderBy:[{year:"desc"},{auditType:"asc"}]});}
