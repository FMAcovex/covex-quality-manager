"use client";
import { useActionState, useEffect } from "react";
import { ActorField, PermissionGate } from "@/components/permissions";
import { CsrfField } from "@/components/csrf";
import { auditWithReturnTo } from "./navigation";
import { actionStatusLabels } from "./finding-domain";
import type { AuditReportActionState } from "./report-actions";

export type CapaPlanFollowupActionRow = { id: string; reference: string; description: string; responsible: string; targetDate: string; status: string; closedAt: string; evidenceReference: string; evidence: string; updatedAt: string };
export type CapaPlanFollowupFindingRow = { id: string; reference: string; description: string; treatment: string; treatmentStatus: string; closedAt: string; evidenceReference: string; evidence: string; updatedAt: string };
const statusOptions = Object.entries(actionStatusLabels);
/** R5C2: seguimiento del CAPA plan. Todas las acciones activas y los hallazgos sin acciones en una tabla editable. */
export function CapaPlanFollowupForm({ action, actions, findings, followupDate, requestId }: { action: (s: AuditReportActionState, fd: FormData) => Promise<AuditReportActionState>; actions: CapaPlanFollowupActionRow[]; findings: CapaPlanFollowupFindingRow[]; followupDate: string; requestId: string }) {
  const [state, submit, pending] = useActionState(action, { error: null } as AuditReportActionState);
  useEffect(() => { if (state.savedHref) window.location.assign(new URL(auditWithReturnTo(state.savedHref, new URL(window.location.href).searchParams.get("returnTo")), window.location.href).href); }, [state.savedHref]);
  const value = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  // «Cerrada» solo con permiso CLOSE (como R5B1), salvo en filas ya cerradas: así cambiar otra columna no las reabre.
  const status = (name: string, current: string) => <select name={name} aria-label="Estado" defaultValue={value(name, current)}>{statusOptions.map(([key, label]) => key === "CLOSED" && current !== "CLOSED" ? <PermissionGate key={key} permission="CLOSE"><option value={key}>{label}</option></PermissionGate> : <option key={key} value={key}>{label}</option>)}</select>;
  const cells = (prefix: string, row: { closedAt: string; evidenceReference: string; evidence: string; updatedAt: string }) => <>
    <td><input type="date" aria-label="Fecha de cierre" name={`${prefix}.closedAt`} defaultValue={value(`${prefix}.closedAt`, row.closedAt)}/></td>
    <td><input aria-label="Referencia de evidencia" name={`${prefix}.evidenceReference`} defaultValue={value(`${prefix}.evidenceReference`, row.evidenceReference)}/></td>
    <td><textarea aria-label="Evidencia u observación" name={`${prefix}.evidence`} defaultValue={value(`${prefix}.evidence`, row.evidence)}/><input type="hidden" name={`${prefix}.updatedAt`} value={row.updatedAt}/></td>
  </>;
  return <form action={submit} key={state.revision ?? 0} className="audit-child-form capa-plan-followup"><CsrfField/>
    {state.error ? <p className="form-errors full" role="alert">{state.error}{state.reload ? <> <button type="button" className="button small" onClick={() => window.location.reload()}>Recargar con los datos actuales</button></> : null}</p> : null}
    <input type="hidden" name="requestId" value={value("requestId", requestId)}/>
    {actions.length ? <div className="full table-scroll"><table className="capa-plan-followup-table"><caption>Acciones del CAPA plan</caption><thead><tr><th>Hallazgo</th><th>Acción</th><th>Fecha objetivo</th><th>Estado</th><th>Fecha de cierre</th><th>Referencia de evidencia</th><th>Evidencia u observación</th></tr></thead><tbody>
      {actions.map(row => { const p = `a.${row.id}`; return <tr key={row.id}><th scope="row">{row.reference}</th><td>{row.description}{row.responsible ? <small> · {row.responsible}</small> : null}</td>
        <td><input type="date" aria-label="Fecha objetivo" name={`${p}.targetDate`} defaultValue={value(`${p}.targetDate`, row.targetDate)}/></td><td>{status(`${p}.status`, row.status)}</td>{cells(p, row)}</tr>; })}
    </tbody></table></div> : null}
    {findings.length ? <div className="full table-scroll"><table className="capa-plan-followup-table"><caption>Hallazgos sin acciones</caption><thead><tr><th>Hallazgo</th><th>Tratamiento o justificación</th><th>Estado</th><th>Fecha de cierre</th><th>Referencia de evidencia</th><th>Evidencia u observación</th></tr></thead><tbody>
      {findings.map(row => { const p = `f.${row.id}`; return <tr key={row.id}><th scope="row">{row.reference}<small> · {row.description}</small></th>
        <td><textarea aria-label="Tratamiento o justificación" name={`${p}.treatment`} defaultValue={value(`${p}.treatment`, row.treatment)}/></td><td>{status(`${p}.treatmentStatus`, row.treatmentStatus)}</td>{cells(p, row)}</tr>; })}
    </tbody></table></div> : null}
    <label className="field"><span>Fecha del seguimiento</span><input type="date" name="followupDate" required defaultValue={value("followupDate", followupDate)}/></label>
    <label className="field"><span>Próxima revisión (opcional)</span><input type="date" name="nextReviewDate" defaultValue={value("nextReviewDate", "")}/></label>
    <label className="field full"><span>Observaciones del seguimiento</span><textarea name="observations" defaultValue={value("observations", "")}/></label>
    <label className="field full"><span>Motivo (obligatorio al cerrar, dar por no aplicable, reabrir, cambiar una fecha de cierre o corregir una evidencia ya registrada)</span><textarea name="changeReason" defaultValue={value("changeReason", "")}/></label>
    <label className="field"><span>Responsable</span><ActorField name="actor" required/></label>
    <div className="full"><button className="button primary" disabled={pending}>{pending ? "Guardando…" : "Registrar seguimiento"}</button><p className="muted-note">Se emite la versión siguiente del CAPA plan con su A4.03. Sin cambios ni observaciones no se registra nada.</p></div>
  </form>;
}
