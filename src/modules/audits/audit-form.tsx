"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ControlledBusinessCodeField } from "@/components/controlled-business-code-field";
import { saveAuditAction } from "./actions";
import type { AuditInput } from "./validation";
import { auditTypeLabels, auditScenarioLabels, auditModalityLabels, auditRoleLabels, auditQualityLabels, compatibleAuditScenario, hasAuditBusinessSeries } from "./domain";

import type { PlanOption } from "./plans";
type DepartmentOption = { id: string; code: string; name: string; isActive: boolean };
export function AuditForm({ id, defaults, departments, plans=[] }: { id?: string; defaults?: Partial<AuditInput>; departments: DepartmentOption[]; plans?: PlanOption[] }) {
  const [state, action, pending] = useActionState(saveAuditAction.bind(null, id ?? null), { error: null } as import("./actions").AuditFormState);
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(Object.entries(defaults ?? {}).flatMap(([k,v]) => typeof v === "string" ? [[k,v]] : [])));
  const [businessCode, setBusinessCode] = useState(defaults?.businessCode ?? "");
  const [type, setType] = useState(defaults?.auditType ?? "");
  const [scenario, setScenario] = useState(defaults?.scenario ?? "");
  const [status, setStatus] = useState(defaults?.status ?? "DRAFT");
  const [planningStatus,setPlanningStatus]=useState(defaults?.planningStatus??"UNCLASSIFIED");
  const [planEntryId,setPlanEntryId]=useState(defaults?.planEntryId??"");
  const [selected, setSelected] = useState(defaults?.departmentIds ?? []);
  const [coding, setCoding] = useState(defaults?.codingDepartmentId ?? "");
  const [entityCode, setEntityCode] = useState(defaults?.entityCode ?? "");
  const [planned, setPlanned] = useState(defaults?.plannedDate ?? "");
  const [opened, setOpened] = useState(defaults?.openedAt ?? "");
  const [performed, setPerformed] = useState(defaults?.performedDate ?? "");
  const [participants, setParticipants] = useState((defaults?.participants ?? []).map((p,i) => ({ ...p, key: p.id ?? `initial-${i}` })));
  const counter = useRef(0), form = useRef<HTMLFormElement>(null);
  const locked = Boolean(id && defaults?.status !== "DRAFT");
  const series = hasAuditBusinessSeries(scenario || null);
  useEffect(() => {
    if (state.savedHref) window.location.assign(state.savedHref);
  }, [state.savedHref]);
  useEffect(() => {
    if (!state.error) return;
    const first = Object.keys(state.fieldErrors ?? {})[0];
    const element = form.current?.querySelector<HTMLElement>(`[data-field="${first}"]`) ?? form.current?.querySelector<HTMLElement>(".form-errors");
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    (element?.querySelector<HTMLElement>("input,select,textarea,button") ?? element)?.focus();
  }, [state]);
  const error = (key: string) => state.fieldErrors?.[key] ? <small className="audit-field-error" role="alert">{state.fieldErrors[key]}</small> : null;
  const text = (name: keyof AuditInput, label: string, long = false) => <label className={`field ${long ? "full" : ""}`} data-field={name} key={name}><span>{label}</span>{long ? <textarea name={name} rows={3} value={values[name] ?? ""} onChange={e => setValues(v => ({...v, [name]:e.target.value}))} aria-invalid={Boolean(state.fieldErrors?.[name])}/> : <input name={name} value={values[name] ?? ""} onChange={e => setValues(v => ({...v, [name]:e.target.value}))} aria-invalid={Boolean(state.fieldErrors?.[name])}/>}{error(name)}</label>;
  const changeDepartments = (ids: string[]) => { setSelected(ids); if (!locked && ids.length === 1 && type === "INTERNAL") setCoding(ids[0]); };
  return <form key={state.formRevision ?? 0} action={action} ref={form} className="audit-form">
    {state.error ? <div className="form-errors" tabIndex={-1} role="alert"><strong>{state.error}</strong><ul>{Object.entries(state.fieldErrors ?? {}).map(([key,value]) => <li key={key}>{value}</li>)}</ul></div> : null}
    <input type="hidden" name="expectedUpdatedAt" value={defaults?.expectedUpdatedAt ?? ""}/>
    <section className="card"><h2>Identificación</h2><div className="form-grid">
      <label className="field" data-field="status"><span>Estado</span><select name="status" value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="DRAFT" disabled={locked}>Borrador</option><option value="OPEN">Abierta</option></select>{error("status")}</label>
      <label className="field" data-field="auditType"><span>Tipo</span><select name="auditType" value={type} onChange={e => { const next = e.target.value as typeof type; setType(next); if (!locked && next === "INTERNAL" && selected.length === 1) setCoding(selected[0]); }} disabled={locked}><option value="">Seleccionar</option>{Object.entries(auditTypeLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>{locked ? <input type="hidden" name="auditType" value={type}/> : null}{error("auditType")}</label>
      <label className="field" data-field="scenario"><span>Escenario</span><select name="scenario" value={scenario} onChange={e => setScenario(e.target.value as typeof scenario)} disabled={locked}><option value="">Seleccionar</option>{Object.entries(auditScenarioLabels).filter(([value]) => !type || compatibleAuditScenario(type, value as Exclude<typeof scenario, "">) || value === scenario).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>{locked ? <input type="hidden" name="scenario" value={scenario}/> : null}{error("scenario")}</label>
      {series ? <div data-field="businessCode"><ControlledBusinessCodeField recordType="AUDIT" label="Código" initialValue={businessCode} onValueChange={setBusinessCode} mode={id ? "edit" : "create"} locked={locked} yearSource={planned || opened || performed} departmentId={coding} auditType={type || null} auditScenario={scenario || null} entityCode={entityCode}/>{error("businessCode")}</div> : <><input type="hidden" name="businessCode" value={businessCode}/><p className="muted-note">Identificación por expediente QMS. La referencia externa no se sustituye por una serie generada.</p></>}
      {text("title", "Objeto / título")}{text("externalReference", "Referencia externa")}
    </div></section>
    <section className="card"><h2>Alcance y entidad</h2><div className="form-grid">
      {text("scope", "Alcance", true)}{text("referenceText", "Referencias / normas", true)}
      {scenario === "SUPPLIER" ? <>{text("auditedEntityName", "Entidad auditada / proveedor")}{text("auditedEntityAddress", "Dirección / lugar")}</> : <><input type="hidden" name="auditedEntityName" value={values.auditedEntityName ?? ""}/>{type === "INTERNAL" ? text("auditedEntityAddress", "Lugar / dirección (opcional)") : <input type="hidden" name="auditedEntityAddress" value={values.auditedEntityAddress ?? ""}/>}</>}
      {["INTERNAL_CONTRACTED", "CLIENT", "AUTHORITY"].includes(scenario) ? text("auditingEntityName", scenario === "AUTHORITY" ? "Autoridad / organismo" : scenario === "CLIENT" ? "Cliente / entidad auditora" : "Entidad auditora contratada") : <input type="hidden" name="auditingEntityName" value={values.auditingEntityName ?? ""}/>}
      {type === "EXTERNAL" || scenario === "INTERNAL_CONTRACTED" ? text("auditedContact", "Contacto externo (nombre, correo y teléfono)", true) : <input type="hidden" name="auditedContact" value={values.auditedContact ?? ""}/>}
      {scenario === "SUPPLIER" || entityCode ? <label className="field" data-field="entityCode"><span>Código de entidad para auditoría</span><input name="entityCode" value={entityCode} readOnly={locked} onChange={e => setEntityCode(e.target.value.toUpperCase())}/>{error("entityCode")}</label> : <input type="hidden" name="entityCode" value={entityCode}/>}
      <fieldset className="field full" data-field="departmentIds"><legend>Departamentos / áreas auditadas</legend><div className="audit-departments">{departments.filter(d => d.isActive || selected.includes(d.id)).map(d => <label key={d.id}><input type="checkbox" name="departmentIds" value={d.id} checked={selected.includes(d.id)} onChange={e => changeDepartments(e.target.checked ? [...selected,d.id] : selected.filter(x => x !== d.id))}/>{d.code} · {d.name}{!d.isActive ? " (inactivo)" : ""}</label>)}</div>{error("departmentIds")}</fieldset>
      {type === "INTERNAL" || coding ? <label className="field full" data-field="codingDepartmentId"><span>Área/departamento de referencia para codificación</span><select name="codingDepartmentId" value={coding} disabled={locked} onChange={e => setCoding(e.target.value)}><option value="">Seleccionar</option>{departments.filter(d => selected.includes(d.id) || d.id === coding).map(d => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}</select>{locked ? <input type="hidden" name="codingDepartmentId" value={coding}/> : null}<small>No limita el alcance de las demás áreas. La serie queda fijada al abrir.</small>{error("codingDepartmentId")}</label> : <input type="hidden" name="codingDepartmentId" value={coding}/>}
    </div></section>
    <section className="card"><h2>Plan anual</h2><p className="muted-note">Clasifica la auditoría: asociada a una entrada del plan, fuera de plan o pendiente de clasificación histórica.</p><div className="form-grid"><label className="field"><span>Vinculación al plan anual</span><select name="planningStatus" value={planningStatus} onChange={e=>{setPlanningStatus(e.target.value as typeof planningStatus);setPlanEntryId("");}}><option value="UNCLASSIFIED">Pendiente de clasificación</option><option value="PLANNED">Incluida en plan anual</option><option value="OUT_OF_PLAN">Fuera de plan</option></select>{error("planningStatus")}</label>
    {planningStatus==="PLANNED"?<label className="field"><span>Auditoría prevista en el plan</span><select name="planEntryId" value={planEntryId} onChange={e=>setPlanEntryId(e.target.value)}><option value="">Seleccionar entrada</option>{plans.filter(p=>!type||p.auditType===type).flatMap(p=>p.entries.filter(entry=>!entry.audit||entry.audit.id===id||entry.id===planEntryId).map(entry=><option key={entry.id} value={entry.id}>{p.year} · {p.auditType==="INTERNAL"?"Interno":"Externo"} · {entry.subject}</option>))}</select>{error("planEntryId")}</label>:<input type="hidden" name="planEntryId" value=""/>}
    {planningStatus==="OUT_OF_PLAN"?text("outsidePlanReason","Motivo de auditoría fuera de plan",true):<input type="hidden" name="outsidePlanReason" value=""/>}
    </div></section>
    <section className="card"><h2>Planificación y realización</h2><div className="form-grid">
      {[["plannedDate", "Fecha prevista", planned, setPlanned], ["performedDate", "Fecha realizada", performed, setPerformed], ["openedAt", "Fecha apertura", opened, setOpened]].map(([name,label,value,setter]) => <label className="field" data-field={String(name)} key={String(name)}><span>{String(label)}</span><input type="date" name={String(name)} value={String(value)} onChange={e => (setter as (v: string) => void)(e.target.value)}/>{error(String(name))}</label>)}
      <label className="field"><span>Modalidad</span><select name="modality" value={values.modality ?? ""} onChange={e => setValues(v => ({...v, modality:e.target.value}))}><option value="">No indicada</option>{Object.entries(auditModalityLabels).map(([v,l]) => <option value={v} key={v}>{l}</option>)}</select></label>
    </div></section>
    <section className="card" data-field="participants"><h2>Equipo y participantes</h2><input type="hidden" name="participants" value={JSON.stringify(participants.map((p,i) => ({ id: p.id, displayName: p.displayName, position: p.position, organization: p.organization, role: p.role, sortOrder: i*10 })))}/>
      <div className="audit-participants">{participants.map((p,i) => <div className="audit-participant" key={p.key}>
        {([['displayName','Nombre y apellidos'],['position','Puesto / cargo'],['organization','Organización']] as const).map(([field,label]) => <label className="field" key={field}><span>{label}</span><input value={p[field]} onChange={e => setParticipants(rows => rows.map((r,n) => n === i ? {...r,[field]:e.target.value} : r))}/></label>)}
        <label className="field"><span>Rol</span><select value={p.role} onChange={e => setParticipants(rows => rows.map((r,n) => n === i ? {...r,role:e.target.value as typeof p.role} : r))}>{Object.entries(auditRoleLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <div className="audit-row-actions"><button type="button" className="button small" disabled={i === 0} aria-label={`Subir participante ${i+1}`} onClick={() => setParticipants(rows => { const next = [...rows]; [next[i-1],next[i]] = [next[i],next[i-1]]; return next; })}>Subir</button><button type="button" className="button small" onClick={() => setParticipants(rows => rows.filter((_,n) => n !== i))}>Retirar</button></div>
      </div>)}</div>
      <button type="button" className="button small" onClick={() => setParticipants(rows => [...rows,{ key: `new-${++counter.current}`, displayName: "", position: "", organization: "", role: "AUDITOR", sortOrder: rows.length*10 }])}>+ Participante</button>{error("participants")}
    </section>
    <section className="card"><h2>Control y observaciones</h2><div className="form-grid">
      {text("internalObservations", "Observaciones internas", true)}
      <label className="field"><span>Control / calidad del dato</span><select name="dataQualityStatus" value={values.dataQualityStatus ?? "INCOMPLETE"} onChange={e => setValues(v => ({...v, dataQualityStatus:e.target.value}))}>{Object.entries(auditQualityLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="field" data-field="actor"><span>Realizado por</span><input name="actor" value={values.actor ?? "Usuario demo"} onChange={e => setValues(v => ({...v, actor:e.target.value}))}/>{error("actor")}</label>{text("changeReason", "Motivo del cambio")}
    </div></section>
    <p className="muted-note">El cierre definitivo se confirma desde Informe y cierre, según los hallazgos, las acciones y la verificación del expediente.</p>
    <div className="heading-actions"><button className="button primary" disabled={pending}>{pending ? "Guardando…" : "Guardar auditoría"}</button><Link className="button" href={id ? `/audits/${id}` : "/audits"}>Cancelar</Link></div>
  </form>;
}
