"use client";
import { CsrfField } from "@/components/csrf";

import { useActionState, useEffect, useState } from "react";
import type { ControlledDocument, ControlledDocumentRevision, Department } from "@prisma/client";
import { masterAction, revisionAction, SaveState } from "../actions";
import { iso } from "../domain";
type Props = {
    returnTo?: string;
    allowExistingRegistration?: boolean;
    departments: Department[];
    master?: ControlledDocument;
    revision?: ControlledDocumentRevision;
    revisions?: ControlledDocumentRevision[];
    revisionOnly?: boolean;
};
export function DocumentForm({ returnTo, allowExistingRegistration = true, departments, master, revision, revisions = [], revisionOnly = false }: Props) {
    const action = revisionOnly ? revisionAction.bind(null, master!.id, revision?.id || null) : masterAction.bind(null, master?.id || null);
    const [state, submit, pending] = useActionState<SaveState, FormData>(action, {});
    const [existing, setExisting] = useState(false);
    useEffect(() => {
        if (state.url)
            window.location.assign(state.url);
    }, [state.url]);
    const revisionFields = revisionOnly || !master;
    const value = (name: string, fallback = "") => {
        const submitted = state.submittedValues?.[name];
        return typeof submitted === "string" ? submitted : fallback;
    };
    return <form key={state.formRevision ?? 0} action={submit} className="form-stack"><CsrfField />
 <input type="hidden" name="returnTo" value={returnTo || ""}/>
 <input type="hidden" name="updatedAt" value={revisionOnly ? revision?.updatedAt.toISOString() || "" : master?.updatedAt.toISOString() || ""}/>
 {state.error && <div className="form-errors" role="alert">{state.error}</div>}
 {!revisionOnly && <fieldset className="form-section"><legend>Identidad del PNT</legend>
 <div className="form-grid pnt-form-grid">
 <label className="field"><span>Código base</span><input name="baseCode" defaultValue={value("baseCode", master?.baseCode || "")} placeholder="GC-00/001" readOnly={master?.administrativeStatus === "ACTIVE"}/></label>
 <label className="field"><span>Departamento responsable</span><select name="departmentId" defaultValue={value("departmentId", master?.departmentId || "")}><option value="">Sin determinar</option>{departments.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}{!d.isActive ? " (histórico / inactivo)" : ""}</option>)}</select></label>
 <label className="field full"><span>Título</span><input name="title" defaultValue={value("title", master?.title || "")}/></label>
 <label className="field"><span>Tipo documental</span><select name="documentType"><option value="PNT">PNT</option></select></label>
 </div>
 </fieldset>}
 {revisionFields && <fieldset className="form-section"><legend>{revisionOnly ? "Revisión" : "Revisión inicial (solo si consta)"}</legend>
 <div className="form-grid pnt-form-grid">
 <label className="field"><span>Revisión explícita</span><input name="revisionCode" defaultValue={value("revisionCode", revision?.revisionCode || "")} placeholder="00" maxLength={2}/></label>
 {revisionOnly && <label className="field"><span>Revisión anterior</span><select name="previousRevisionId" defaultValue={value("previousRevisionId", revision?.previousRevisionId || "")}><option value="">No documentada</option>{revisions.filter(r => r.id !== revision?.id).map(r => <option key={r.id} value={r.id}>{r.revisionCode}</option>)}</select></label>}
 <p className="section-help pnt-help full">00 es la revisión original. No se crean automáticamente revisiones anteriores.</p>
 <label className="field full"><span>Motivo de revisión</span><textarea name="revisionReason" defaultValue={value("revisionReason", revision?.revisionReason || "")}/></label>
 {allowExistingRegistration && <label className="pnt-check full"><input type="checkbox" name="existingDocument" checked={existing} onChange={e => setExisting(e.target.checked)}/> Registrar revisión documental ya existente</label>}
 <p className="section-help pnt-help full">El borrador queda en elaboración. El registro documental exige contraste con una fuente real; no constituye una aprobación en la aplicación.</p>
 <label className="field"><span>Fecha de vigencia</span><input type="date" name="effectiveFrom" defaultValue={value("effectiveFrom", iso(revision?.effectiveFrom))}/></label>
 <label className="field"><span>Fecha prevista de revisión</span><input type="date" name="reviewDueAt" defaultValue={value("reviewDueAt", iso(revision?.reviewDueAt))}/></label>
 <p className="section-help pnt-help full">En un borrador, las fechas previstas no activan la revisión ni acreditan su aprobación.</p>
 {existing && <>
 <label className="field"><span>Estado documental existente</span><select name="existingStatus" defaultValue={value("existingStatus", "IN_FORCE")}><option value="IN_FORCE">Vigente</option><option value="OBSOLETE">Obsoleto</option><option value="ANNULLED">Anulado</option></select></label>
 <label className="field"><span>Fecha de obsolescencia</span><input type="date" name="obsoletedAt" defaultValue={value("obsoletedAt", iso(revision?.obsoletedAt))}/></label>
 <p className="section-help pnt-help full">Validez general de cinco años según GC-00/001/03. Registra las fechas documentadas; las fechas ausentes no se inventan.</p>
 <label className="pnt-check full"><input type="checkbox" name="verified" defaultChecked={value("verified") === "on"}/> He contrastado la revisión y su estado con la fuente documental</label>
 </>}
 <label className="field full"><span>Referencia documental</span><textarea name="sourceReference" defaultValue={value("sourceReference", revision?.sourceReference || "")} placeholder="Ubicación o referencia de la fuente controlada"/></label>
 </div>
 </fieldset>}
 <fieldset className="form-section"><legend>Metadatos adicionales</legend><div className="form-grid pnt-form-grid">
 {!revisionOnly && <label className="field full"><span>Observaciones (opcional)</span><textarea name="observations" defaultValue={value("observations", master?.observations || "")}/></label>}
 <label className="field"><span>Responsable del registro</span><input name="actor" required defaultValue={value("actor")}/></label>
 <label className="field full"><span>Motivo del registro o cambio</span><textarea name="changeReason" defaultValue={value("changeReason")} required={!!master || revisionOnly}/></label>
 </div></fieldset>
 <div className="form-actions pnt-form-actions">
 {!master && !revisionOnly && <button className="button" disabled={pending || existing} name="operation" value="DRAFT">Guardar borrador</button>}
 {master?.administrativeStatus === "DRAFT" && !revisionOnly && <button className="button primary" disabled={pending} name="operation" value="REGISTER">Completar y registrar PNT</button>}
 <button className={`button ${master?.administrativeStatus === "DRAFT" && !revisionOnly ? "" : "primary"}`} disabled={pending} name="operation" value={revisionOnly ? "REGISTER" : master ? "EDIT" : "REGISTER"}>{pending ? "Guardando…" : master && !revisionOnly ? "Guardar cambios" : revisionOnly ? "Guardar revisión" : "Registrar PNT"}</button>
 </div>
 </form>;
}
