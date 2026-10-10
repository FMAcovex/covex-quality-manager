"use client";
import { useActionState, useEffect } from "react";
import { auditWithReturnTo } from "./navigation";
import { actionStatusLabels, criticalityLabels, findingTypeLabels } from "./finding-domain";
import type { AuditChildFormState, AuditRetirementFormState } from "./finding-actions";
function useSavedAuditNavigation(savedHref?: string) {
  useEffect(() => {
    if (!savedHref) return;
    const target = new URL(auditWithReturnTo(savedHref, new URL(window.location.href).searchParams.get("returnTo")),window.location.href);
    if (target.pathname === window.location.pathname && target.search === window.location.search) {
      // A fragment-only navigation would retain the current RSC tree after saving.
      window.history.replaceState(window.history.state, "", target.href);
      window.location.reload();
    } else window.location.assign(target.href);
  }, [savedHref]);
}
export function AuditChildForm({ action, kind, defaults = {}, findings = [], buttonLabel = "Guardar" }: { action: (state: AuditChildFormState, form: FormData) => Promise<AuditChildFormState>; kind: "finding" | "action" | "followup"; defaults?: Record<string,string>; findings?: {id:string;reference:string;isActive:boolean}[]; buttonLabel?: string }) {
  const [state, formAction, pending] = useActionState(action, { error: null } as AuditChildFormState);
  useSavedAuditNavigation(state.savedHref);
  const values = { ...defaults, ...state.values };
  const field = (name: string, label: string, type = "text", required = false) => <label className={`field ${type === "textarea" ? "full" : ""}`} key={name}><span>{label}</span>{type === "textarea" ? <textarea name={name} defaultValue={values[name] ?? ""} required={required} rows={3}/> : <input name={name} type={type} defaultValue={values[name] ?? (name === "actor" ? "Usuario demo" : name === "sortOrder" ? "0" : "")} required={required}/>}</label>;
  const select = (name: string, label: string, labels: Record<string,string>, initial: string) => <label className="field"><span>{label}</span><select name={name} defaultValue={values[name] ?? initial}>{Object.entries(labels).map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  return <form action={formAction} key={state.revision ?? 0} className="audit-child-form">
    {state.error ? <div className="form-errors full" role="alert">{state.error}</div> : null}
    <input type="hidden" name="expectedUpdatedAt" value={values.expectedUpdatedAt ?? ""}/>
    {kind === "finding" ? <><h3 className="full">Identificación</h3><p className="full">Referencia: <strong>{defaults.reference || "Se asignará al guardar (OBS / Rk)"}</strong></p>{select("findingType", "Tipo", findingTypeLabels, "FINDING")}{select("criticality", "Criticidad", criticalityLabels, "NA")}{field("sortOrder", "Orden visual", "number")}
      <h3 className="full">Descripción</h3>{field("description", "Descripción", "textarea", true)}{field("criterionReference", "Criterio / referencia", "textarea")}{field("objectiveEvidence", "Evidencia objetiva", "textarea")}
      <h3 className="full">Tratamiento</h3>{field("treatment", "Acciones / justificación", "textarea")}{select("treatmentStatus", "Estado del tratamiento sin acciones", actionStatusLabels, "OPEN")}<p className="muted-note full">Con acciones activas, el estado del hallazgo se calcula a partir de ellas. Las recomendaciones pueden permanecer sin expediente derivado.</p></> : null}
    {kind === "action" ? <><h3 className="full">Acción del CAPA Plan</h3>{field("description", "Descripción de acción", "textarea", true)}{field("responsible", "Responsable de ejecución")}{field("targetDate", "Fecha objetivo", "date")}{select("status", "Estado de acción", actionStatusLabels, "OPEN")}{field("sortOrder", "Orden visual", "number")}{select("verificationResult", "Resultado de verificación", { PENDING: "Pendiente", CONFORMING: "Conforme / eficaz", NONCONFORMING: "No conforme / no eficaz", NA: "No aplica" }, "PENDING")}{field("verifiedAt", "Fecha de verificación", "date")}{field("verifiedBy", "Verificado por")}</> : null}
    {kind === "followup" ? <><h3 className="full">Seguimiento</h3><label className="field"><span>Ámbito</span><select name="findingId" defaultValue={values.findingId ?? ""}><option value="">General de la auditoría</option>{findings.filter(f => f.isActive || f.id === values.findingId).map(f => <option key={f.id} value={f.id}>{f.reference}{!f.isActive ? " · Retirado" : ""}</option>)}</select></label>{field("followupDate", "Fecha de seguimiento", "date", true)}{field("completedByText", "Responsable del seguimiento", "text", true)}{field("description", "Descripción del seguimiento", "textarea", true)}{field("nextReviewDate", "Próxima revisión", "date")}{field("evidenceReference", "Referencia de evidencia", "textarea")}</> : <>{field("closedAt", "Fecha de cierre", "date")}{field("evidence", "Evidencia / observaciones", "textarea")}{field("evidenceReference", "Referencia documental", "textarea")}{field("verificationComment", "Comentario de verificación", "textarea")}</>}
    {field("actor", "Registrado por", "text", true)}{field("changeReason", "Motivo del cambio")}
    <div className="full"><button className="button primary" disabled={pending}>{pending ? "Guardando…" : buttonLabel}</button></div>
  </form>;
}
export function AuditRetirementForm({ action, label }: { action: (state: AuditRetirementFormState, form: FormData) => Promise<AuditRetirementFormState>; label: string }) {
  const [state, formAction, pending] = useActionState(action, { error: null } as AuditRetirementFormState);
  useSavedAuditNavigation(state.savedHref);
  return <form action={formAction} className="audit-child-form"><p className="full">{label}</p>{state.error ? <p className="form-errors full" role="alert">{state.error}</p> : null}{state.success ? <p className="form-success full">{state.success}</p> : null}<label className="field"><span>Motivo</span><input name="reason" required/></label><label className="field"><span>Registrado por</span><input name="actor" required defaultValue="Usuario demo"/></label><div className="full"><button className="button danger small" disabled={pending}>{label}</button></div></form>;
}
