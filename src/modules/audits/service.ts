import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assignOperationalBusinessCode } from "@/lib/qms/business-code";
import { auditInputSchema, type AuditInput } from "./validation";
import { auditCodeYear, hasAuditBusinessSeries } from "./domain";

export class AuditValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) { super(Object.values(fields).join(" ")); }
}
const nullable = (value: string) => value || null;
const date = (value: string) => value ? new Date(`${value}T00:00:00.000Z`) : null;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function saveAudit(raw: unknown, id?: string) {
  const parsed = auditInputSchema.safeParse(raw);
  if (!parsed.success) throw new AuditValidationError(Object.fromEntries(parsed.error.issues.map(i => [String(i.path[0]), i.message])));
  const v = parsed.data;
  return prisma.$transaction(async tx => {
    // Serialize updates; code allocation also locks the business series/year.
    if (id) await tx.$queryRaw(Prisma.sql`SELECT id FROM "Audit" WHERE id = ${id} FOR UPDATE`);
    if (id) await tx.$queryRaw(Prisma.sql`SELECT id FROM "QmsRecord" WHERE id = (SELECT "qmsRecordId" FROM "Audit" WHERE id = ${id}) FOR UPDATE`);
    const before = id ? await tx.audit.findUnique({ where: { id }, include: { qmsRecord: true, departments: true, participants: true } }) : null;
    if (id && !before) throw new AuditValidationError({ title: "La auditoría no existe." });
    if (before && !before.qmsRecord.isActive) throw new AuditValidationError({ title: "Reactiva el expediente antes de editarlo." });
    if (before?.status === "CLOSED" && v.status !== "CLOSED") throw new AuditValidationError({ status: "La auditoría cerrada no se reabre automáticamente." });
    if (before && v.expectedUpdatedAt && v.expectedUpdatedAt !== before.updatedAt.toISOString()) throw new AuditValidationError({ title: "El expediente cambió desde que abriste el formulario. Recarga antes de guardar." });
    if (before && before.status !== "DRAFT") {
      if (v.status === "DRAFT") throw new AuditValidationError({ status: "Una auditoría operativa no puede volver a Borrador." });
      for (const field of ["auditType", "scenario", "codingDepartmentId", "entityCode"] as const) {
        if ((before[field] ?? "") !== v[field]) throw new AuditValidationError({ [field]: "La identificación y serie quedan fijadas al abrir la auditoría." });
      }
      if (v.businessCode !== (before.qmsRecord.businessCode ?? "")) throw new AuditValidationError({ businessCode: "El código operativo no se puede modificar." });
    }
    let selectedPlan: {id:string;year:number;auditType:import("@prisma/client").AuditType;plannedDate:Date|null;isActive:boolean;audit:{id:string}|null}|null=null;
    if(v.planningStatus === "PLANNED"){
      const entry=await tx.auditPlanEntry.findUnique({where:{id:v.planEntryId},include:{plan:true,audit:{select:{id:true}}}});
      if(!entry||!entry.isActive)throw new AuditValidationError({planEntryId:"La entrada del plan anual no está disponible."});
      if(!v.auditType||entry.plan.auditType!==v.auditType)throw new AuditValidationError({planEntryId:"El tipo de auditoría no corresponde al plan anual."});
      if(entry.audit&&entry.audit.id!==id)throw new AuditValidationError({planEntryId:"Esta entrada ya tiene otra auditoría vinculada."});
      const year=auditCodeYear(v);
      if(v.status==="OPEN"&&year!==entry.plan.year)throw new AuditValidationError({plannedDate:"El año operativo debe coincidir con el plan seleccionado."});
      selectedPlan={id:entry.id,year:entry.plan.year,auditType:entry.plan.auditType,plannedDate:entry.plannedDate,isActive:entry.isActive,audit:entry.audit};
    }
    if(before?.planEntryId&&before.planEntryId!==selectedPlan?.id){
      if(!v.changeReason.trim())throw new AuditValidationError({changeReason:"Justifica el cambio de clasificación o de plan."});
    }
    if(before&&before.planningStatus!==v.planningStatus&&!v.changeReason.trim())throw new AuditValidationError({changeReason:"Indica el motivo de la reclasificación."});
    const oldDepartments = new Map(before?.departments.map(d => [d.departmentId, d]) ?? []);
    const departments = await tx.department.findMany({ where: { id: { in: v.departmentIds } } });
    if (departments.length !== v.departmentIds.length || departments.some(d => !d.isActive && !oldDepartments.get(d.id)?.isActive)) throw new AuditValidationError({ departmentIds: "Selecciona departamentos existentes y activos; los históricos seleccionados se conservan." });
    if (v.auditType === "INTERNAL" && v.codingDepartmentId && !v.departmentIds.includes(v.codingDepartmentId)) throw new AuditValidationError({ codingDepartmentId: "El área de codificación debe permanecer entre las áreas auditadas." });
    const oldParticipants = new Map(before?.participants.map(p => [p.id, p]) ?? []);
    if (v.participants.some(p => p.id && !oldParticipants.has(p.id))) throw new AuditValidationError({ participants: "Un participante no pertenece a este expediente." });
    const coding = v.auditType === "INTERNAL" ? departments.find(d => d.id === v.codingDepartmentId) : undefined;
    const year = before && before.status !== "DRAFT" ? before.qmsRecord.year : auditCodeYear(v);
    const series = hasAuditBusinessSeries(v.scenario || null);
    if (!series && v.businessCode) throw new AuditValidationError({ businessCode: "Cliente e inspección utilizan referencia externa y UUID QMS, sin código oficial generado." });
    if (v.auditType !== "INTERNAL" && v.codingDepartmentId) throw new AuditValidationError({ codingDepartmentId: "El departamento de codificación solo aplica a internas; corrige el valor conservado." });
    let businessCode = before?.qmsRecord.businessCode ?? null;
    if ((!before || before.status === "DRAFT") && series && (v.status === "OPEN" || v.businessCode)) {
      if (!year) throw new AuditValidationError({ plannedDate: "Indica una fecha para calcular el año del código." });
      businessCode = await assignOperationalBusinessCode(tx, { recordType: "AUDIT", auditType: v.auditType || null, auditScenario: v.scenario || null, departmentCode: coding?.code, entityCode: v.entityCode, year, requestedCode: v.businessCode, excludeQmsRecordId: before?.qmsRecordId });
    } else if (!before || before.status === "DRAFT") businessCode = null;
    const qmsRecord = before ? await tx.qmsRecord.update({ where: { id: before.qmsRecordId }, data: { businessCode, year } }) : await tx.qmsRecord.create({ data: { recordType: "AUDIT", businessCode, year } });
    const openedAt = date(v.openedAt) ?? (v.status === "OPEN" ? (before?.openedAt ?? new Date(new Date().toISOString().slice(0, 10))) : null);
    const data = {
      auditType: v.auditType || null, scenario: v.scenario || null, status: v.status,
      planningStatus:v.planningStatus,planEntryId:selectedPlan?.id??null,outsidePlanReason:v.planningStatus==="OUT_OF_PLAN"?nullable(v.outsidePlanReason):null,
      title: nullable(v.title), scope: nullable(v.scope), referenceText: nullable(v.referenceText), externalReference: nullable(v.externalReference),
      auditedEntityName: nullable(v.auditedEntityName), auditedEntityAddress: nullable(v.auditedEntityAddress), auditingEntityName: nullable(v.auditingEntityName), entityCode: nullable(v.entityCode),
      codingDepartmentId: coding?.id ?? null,
      codingDepartmentCodeSnapshot: coding ? (before?.codingDepartmentId === coding.id ? before.codingDepartmentCodeSnapshot ?? coding.code : coding.code) : null,
      codingDepartmentNameSnapshot: coding ? (before?.codingDepartmentId === coding.id ? before.codingDepartmentNameSnapshot ?? coding.name : coding.name) : null,
      plannedDate: date(v.plannedDate), performedDate: date(v.performedDate), openedAt,
      modality: v.modality || null, internalObservations: nullable(v.internalObservations), dataQualityStatus: v.dataQualityStatus, updatedByText: v.actor,
    };
    const audit = before ? await tx.audit.update({ where: { id: before.id }, data }) : await tx.audit.create({ data: { ...data, qmsRecordId: qmsRecord.id, createdByText: v.actor } });
    await tx.auditDepartment.updateMany({ where: { auditId: audit.id, departmentId: { notIn: v.departmentIds }, isActive: true }, data: { isActive: false } });
    for (const department of departments) await tx.auditDepartment.upsert({
      where: { auditId_departmentId: { auditId: audit.id, departmentId: department.id } }, update: { isActive: true },
      create: { auditId: audit.id, departmentId: department.id, departmentCodeSnapshot: department.code, departmentNameSnapshot: department.name },
    });
    await tx.auditParticipant.updateMany({ where: { auditId: audit.id, isActive: true, id: { notIn: v.participants.flatMap(p => p.id ? [p.id] : []) } }, data: { isActive: false } });
    for (const participant of v.participants) {
      const pd = { displayName: participant.displayName, position: nullable(participant.position), organization: nullable(participant.organization), role: participant.role, sortOrder: participant.sortOrder, isActive: true };
      if (participant.id) await tx.auditParticipant.update({ where: { id: participant.id }, data: pd });
      else await tx.auditParticipant.create({ data: { ...pd, auditId: audit.id } });
    }
    const after = await tx.audit.findUniqueOrThrow({ where: { id: audit.id }, include: { qmsRecord: true, departments: true, participants: true } });
    const event = async (fieldPath: string, oldValue: unknown, newValue: unknown, reason: string) => tx.changeHistory.create({ data: { qmsRecordId: qmsRecord.id, fieldPath, oldValue: json(oldValue), newValue: json(newValue), changedByText: v.actor, source: "UI", reason } });
    if (!before) await event("__created__", null, { id: audit.id, ...data, businessCode }, "Alta de auditoría");
    else for (const field of Object.keys(data) as (keyof typeof data)[]) {
      if (field === "updatedByText") continue;
      if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) await event(`audit.${field}`, before[field], after[field], v.changeReason || (field === "status" ? "Apertura de auditoría" : "Edición del expediente base"));
    }
    if((before?.planEntryId??null)!==(selectedPlan?.id??null)||before?.planningStatus!==v.planningStatus){
      const changedPlans=[before?.planEntryId,selectedPlan?.id].filter((v):v is string=>Boolean(v));
      const planRows=changedPlans.length?await tx.auditPlanEntry.findMany({where:{id:{in:changedPlans}},select:{planId:true}}):[];
      for(const planId of [...new Set(planRows.map(x=>x.planId))])await tx.auditPlanChange.create({data:{planId,event:"AUDIT_CLASSIFICATION",actor:v.actor,reason:v.changeReason||"Asignación inicial de auditoría",oldValue:json({auditId:before?.id??null,planningStatus:before?.planningStatus??null,planEntryId:before?.planEntryId??null}),newValue:json({auditId:audit.id,planningStatus:v.planningStatus,planEntryId:selectedPlan?.id??null})}});
    }
    if ((before?.qmsRecord.businessCode ?? null) !== businessCode) await event("businessCode", before?.qmsRecord.businessCode ?? null, businessCode, "Asignación de codificación");
    for (const child of ["departments", "participants"] as const) {
      const project = (rows: typeof after[typeof child]) => rows.filter(r => r.isActive).map(r => {
        return Object.fromEntries(Object.entries(r).filter(([key]) => !["createdAt", "updatedAt"].includes(key)));
      }).sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const previous = project(before?.[child] ?? []), current = project(after[child]);
      if (JSON.stringify(previous) !== JSON.stringify(current)) await event(`audit.${child}`, previous, current, v.changeReason || "Cambio de participantes/áreas");
    }
    return after;
  }, { timeout: 20000 });
}

export function auditDefaults(audit: Awaited<ReturnType<typeof saveAudit>>): AuditInput {
  const day = (v: Date | null) => v?.toISOString().slice(0, 10) ?? "";
  return {
    auditType: audit.auditType ?? "", scenario: audit.scenario ?? "", status: audit.status,
    planningStatus:audit.planningStatus,planEntryId:audit.planEntryId??"",outsidePlanReason:audit.outsidePlanReason??"",
    title: audit.title ?? "", scope: audit.scope ?? "", referenceText: audit.referenceText ?? "", externalReference: audit.externalReference ?? "",
    auditedEntityName: audit.auditedEntityName ?? "", auditedEntityAddress: audit.auditedEntityAddress ?? "", auditingEntityName: audit.auditingEntityName ?? "", entityCode: audit.entityCode ?? "",
    codingDepartmentId: audit.codingDepartmentId ?? "", departmentIds: audit.departments.filter(d => d.isActive).map(d => d.departmentId),
    participants: audit.participants.filter(p => p.isActive).sort((a,b) => a.sortOrder - b.sortOrder).map(p => ({ id: p.id, displayName: p.displayName, position: p.position ?? "", organization: p.organization ?? "", role: p.role, sortOrder: p.sortOrder })),
    businessCode: audit.status === "DRAFT" && audit.qmsRecord.businessCode?.startsWith("DEMO-") ? "" : audit.qmsRecord.businessCode ?? "", plannedDate: day(audit.plannedDate), performedDate: day(audit.performedDate), openedAt: day(audit.openedAt), modality: audit.modality ?? "",
    internalObservations: audit.internalObservations ?? "", dataQualityStatus: audit.dataQualityStatus, actor: "Usuario demo", changeReason: "", expectedUpdatedAt: audit.updatedAt.toISOString(),
  };
}
