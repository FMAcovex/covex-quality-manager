import { z } from "zod";
import type { ChangeControlActionInput } from "@/modules/change-control/types";

const scope = z.enum(["FACILITIES","EQUIPMENT","PROCESS","MATERIAL","SUPPLIER","DOCUMENTATION","OTHER"]);
const classification = z.enum(["MAJOR","MINOR"]);
const requestStatus = z.enum(["PENDING","ACCEPTED","DENIED"]);
const decision = z.enum(["PENDING","APPROVED","REJECTED"]);
const execution = z.enum(["NOT_EXECUTED","EXECUTED"]);
const effectiveness = z.enum(["PENDING","ACCEPTABLE","NOT_ACCEPTABLE"]);
const status = z.enum(["OPEN","CLOSED","REJECTED","CANCELLED"]);
const triState = z.enum(["YES","NO","NA"]);
const dataQuality = z.enum(["COMPLETE","INCOMPLETE","REVIEW_REQUIRED"]);

const actionSchema = z.object({
  departmentText: z.string().trim(),
  description: z.string().trim().min(1),
  responsible: z.string().trim(),
  plannedExecutionDate: z.string().trim(),
  actualExecutionDate: z.string().trim(),
  completed: z.boolean(),
  evidenceComment: z.string().trim(),
  introducedInSequence: z.number().nullable().optional(),
});

function text(formData: FormData, name: string): string | null {
  const value=formData.get(name);
  if(typeof value!=="string") return null;
  const trimmed=value.trim();
  return trimmed || null;
}
function bool(formData: FormData,name:string) {
  return text(formData,name)==="true" ? true : text(formData,name)==="false" ? false : null;
}
function enumValue<T extends z.ZodTypeAny>(schema:T,value:string|null) {
  if(!value) return null;
  const parsed=schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
function parseActions(raw:string|null):ChangeControlActionInput[] {
  if(!raw) return [];
  try {
    const value=JSON.parse(raw);
    if(!Array.isArray(value)) return [];
    return value
      .map((item)=>actionSchema.safeParse(item))
      .filter((result):result is z.SafeParseSuccess<ChangeControlActionInput>=>result.success)
      .map((result)=>result.data);
  } catch { return []; }
}

export function parseChangeControlForm(formData:FormData,{historical=false}:{historical?:boolean}={}) {
  const businessCode=text(formData,"businessCode");
  const departmentId=text(formData,"departmentId");
  const requestedAt=text(formData,"requestedAt");
  const requesterName=text(formData,"requesterName");
  const description=text(formData,"description");
  const justification=text(formData,"justification");
  const requestState=enumValue(requestStatus,text(formData,"requestStatus")) ?? "PENDING";
  const decisionResult=enumValue(decision,text(formData,"decisionResult")) ?? "PENDING";
  const executionStatus=enumValue(execution,text(formData,"executionStatus")) ?? "NOT_EXECUTED";
  const effectivenessStatus=enumValue(effectiveness,text(formData,"effectivenessStatus")) ?? "PENDING";
  const recordStatus=enumValue(status,text(formData,"status")) ?? "OPEN";
  const actions=parseActions(text(formData,"actionsJson"));
  const scopes=formData.getAll("scopes")
    .filter((v):v is string=>typeof v==="string")
    .map((v)=>enumValue(scope,v))
    .filter((v):v is z.infer<typeof scope>=>Boolean(v));

  const errors:string[]=[];
  if(!businessCode) errors.push("La codificación del control de cambio es obligatoria.");
  if(!departmentId) errors.push("El departamento/área solicitante es obligatorio.");
  if(!requestedAt) errors.push("La fecha de solicitud es obligatoria.");
  if(!requesterName) errors.push("El solicitante es obligatorio.");
  if(!scopes.length) errors.push("Debe seleccionarse al menos un alcance del cambio.");
  if(!description) errors.push("La descripción del cambio es obligatoria.");
  if(!justification) errors.push("La justificación del cambio es obligatoria.");

  if(requestState==="ACCEPTED" && !text(formData,"requestDecisionAt") && !historical) {
    errors.push("Una solicitud aceptada debe indicar la fecha de aceptación.");
  }
  if(requestState==="DENIED" && recordStatus==="OPEN" && !historical) {
    errors.push("Una solicitud denegada no puede permanecer Abierta.");
  }
  if(decisionResult==="APPROVED" && !text(formData,"decisionAt") && !historical) {
    errors.push("Un dictamen aprobado debe indicar la fecha de aprobación.");
  }
  if(decisionResult==="APPROVED" && !enumValue(classification,text(formData,"classification")) && !historical) {
    errors.push("Un cambio aprobado debe clasificarse como Mayor o Menor.");
  }
  if(decisionResult==="APPROVED" && !actions.length && !historical) {
    errors.push("Un cambio aprobado debe disponer de plan de ejecución.");
  }
  if(executionStatus==="EXECUTED" && !text(formData,"executedAt") && !historical) {
    errors.push("Un cambio ejecutado debe tener fecha de ejecución.");
  }
  const closeWithoutExecution=formData.get("closeWithoutExecution")==="on";
  if(recordStatus==="CLOSED" && !historical) {
    if(executionStatus==="EXECUTED") {
      if(effectivenessStatus!=="ACCEPTABLE") {
        errors.push("Para cerrar un cambio ejecutado, la eficacia debe ser Aceptable.");
      }
      if(!text(formData,"effectiveClosedAt")) {
        errors.push("El cierre efectivo requiere fecha de cierre.");
      }
    } else if(!closeWithoutExecution) {
      errors.push("Un cambio cerrado sin ejecución debe marcarse como cierre sin ejecución.");
    }
    if(!text(formData,"closureConclusion")) {
      errors.push("El cierre requiere motivo/conclusión.");
    }
  }

  return {
    errors,
    actor:text(formData,"modifiedByText") ?? requesterName ?? "Usuario no informado",
    values:{
      businessCode,departmentId,requestedAt,requesterName,
      requesterPosition:text(formData,"requesterPosition"),
      scopes,scopeOther:text(formData,"scopeOther"),description,justification,
      supportingDocuments:text(formData,"supportingDocuments"),
      requestStatus:requestState,
      requestResponsible:text(formData,"requestResponsible"),
      acceptedByText:text(formData,"acceptedByText"),
      requestDecisionAt:text(formData,"requestDecisionAt"),
      evaluation:text(formData,"evaluation"),
      classification:enumValue(classification,text(formData,"classification")),
      plannedImplementationAt:text(formData,"plannedImplementationAt"),
      committeeRequired:bool(formData,"committeeRequired"),
      committeeJustification:text(formData,"committeeJustification"),
      clientNotificationRequired:bool(formData,"clientNotificationRequired"),
      clientNotificationDetail:text(formData,"clientNotificationDetail"),
      authorityNotificationRequired:bool(formData,"authorityNotificationRequired"),
      authorityNotificationDetail:text(formData,"authorityNotificationDetail"),
      pqrRequirement:enumValue(triState,text(formData,"pqrRequirement")),
      pqrProducts:text(formData,"pqrProducts"),
      pqrPeriod:text(formData,"pqrPeriod"),
      stabilityRequirement:enumValue(triState,text(formData,"stabilityRequirement")),
      stabilityAccelerated:formData.get("stabilityAccelerated")==="on",
      stabilityOngoing:formData.get("stabilityOngoing")==="on",
      stabilityDetail:text(formData,"stabilityDetail"),
      additionalAnalysis:enumValue(triState,text(formData,"additionalAnalysis")),
      additionalAnalysisDetail:text(formData,"additionalAnalysisDetail"),
      additionalValidation:enumValue(triState,text(formData,"additionalValidation")),
      additionalValidationDetail:text(formData,"additionalValidationDetail"),
      otherImplication:bool(formData,"otherImplication"),
      otherImplicationDetail:text(formData,"otherImplicationDetail"),
      decisionResult,
      decisionAt:text(formData,"decisionAt"),
      followupResponsible:text(formData,"followupResponsible"),
      decisionObservations:text(formData,"decisionObservations"),
      approvedByText:text(formData,"approvedByText"),
      executionStatus,
      executedAt:text(formData,"executedAt"),
      operationalClosedAt:text(formData,"operationalClosedAt"),
      effectivenessStatus,
      effectivenessObservations:text(formData,"effectivenessObservations"),
      effectiveClosedAt:text(formData,"effectiveClosedAt"),
      status:recordStatus,
      closeWithoutExecution,
      closureConclusion:text(formData,"closureConclusion"),
      internalObservations:text(formData,"internalObservations"),
      signedDocumentAvailable:bool(formData,"signedDocumentAvailable"),
      dataQualityStatus:enumValue(dataQuality,text(formData,"dataQualityStatus")) ?? "REVIEW_REQUIRED",
      actions,
      changeReason:text(formData,"changeReason"),
    },
  };
}
