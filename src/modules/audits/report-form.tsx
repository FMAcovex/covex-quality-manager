"use client";
import { ActorField } from "@/components/permissions";
import { CsrfField } from "@/components/csrf";

import { auditWithReturnTo } from "./navigation";
import { useActionState, useEffect } from "react";
import type { AuditReportActionState } from "./report-actions";
export type AuditReportFormField = { name: string; label: string; type?: 'text'|'date'|'textarea'|'checkbox'|'file'|'hidden'; value?: string; required?: boolean; options?: Record<string,string> };
export function AuditCloseNavigation({id,disabled}:{id:string;disabled:boolean}) { return <button className="button" disabled={disabled} onClick={()=>window.location.assign(auditWithReturnTo(`/audits/${id}?tab=report`,new URL(window.location.href).searchParams.get("returnTo")))}>Cerrar auditoría</button>; }
export function AuditReportForm({ action, fields, label, disabled = false }: { action:(s:AuditReportActionState,fd:FormData)=>Promise<AuditReportActionState>; fields:AuditReportFormField[]; label:string; disabled?:boolean }) {
  const [state,submit,pending]=useActionState(action,{error:null} as AuditReportActionState);
  useEffect(()=>{if(state.savedHref){const target=new URL(auditWithReturnTo(state.savedHref,new URL(window.location.href).searchParams.get("returnTo")),window.location.href);if(target.href===window.location.href)window.location.reload();else window.location.assign(target.href);}},[state.savedHref]);
  return <form action={submit} key={state.revision ?? 0} className="audit-child-form"><CsrfField />
    {state.error?<p className="form-errors full" role="alert">{state.error}</p>:null}
    {fields.map(f=>{const value=f.type==='checkbox'&&state.values ? state.values[f.name] ?? '' : state.values?.[f.name] ?? f.value ?? '';
      if(f.type==='hidden')return <input key={f.name} name={f.name} type="hidden" value={value}/>;
      return <label key={f.name} className={`field ${f.type==='textarea'?'full':''}`}><span>{f.label}</span>{f.name === 'actor' ? <ActorField name={f.name} required={f.required}/> : f.options?<select name={f.name} defaultValue={value}>{Object.entries(f.options).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select>:f.type==='textarea'?<textarea name={f.name} defaultValue={value} required={f.required}/>:f.type==='checkbox'?<input name={f.name} type="checkbox" defaultChecked={value==='on'}/>:<input name={f.name} type={f.type ?? 'text'} defaultValue={f.type==='file'?undefined:value} accept={f.type==='file'?'.pdf,.docx,.xlsx':undefined} required={f.required}/>}</label>;
    })}<div className="full"><button className="button primary" disabled={disabled||pending}>{pending?'Guardando…':label}</button></div>
  </form>;
}
