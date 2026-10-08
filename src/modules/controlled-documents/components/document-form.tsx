"use client";
import { useActionState, useEffect, useState } from "react";
import type { ControlledDocument, ControlledDocumentRevision, Department } from "@prisma/client";
import { masterAction, revisionAction, SaveState } from "../actions";
import { iso } from "../domain";
type Props = {
    departments: Department[];
    master?: ControlledDocument;
    revision?: ControlledDocumentRevision;
    revisions?: ControlledDocumentRevision[];
    revisionOnly?: boolean;
};
export function DocumentForm({ departments, master, revision, revisions = [], revisionOnly = false }: Props) {
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
    return <form key={state.formRevision ?? 0} action={submit} className="form-grid">
 <input type="hidden" name="updatedAt" value={revisionOnly ? revision?.updatedAt.toISOString() || "" : master?.updatedAt.toISOString() || ""}/>
 {state.error && <p role="alert">{state.error}</p>}
 {!revisionOnly && <fieldset className="form-section"><legend>Identidad del PNT</legend>
 <label>Código base<input name="baseCode" defaultValue={value("baseCode", master?.baseCode || "")} placeholder="GC-00/001" readOnly={master?.administrativeStatus === "ACTIVE"}/></label>
 <label>Título<input name="title" defaultValue={value("title", master?.title || "")}/></label>
 <label>Departamento responsable<select name="departmentId" defaultValue={value("departmentId", master?.departmentId || "")}><option value="">Sin determinar</option>{departments.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}{!d.isActive ? " (histórico / inactivo)" : ""}</option>)}</select></label>
 <label>Tipo documental<select name="documentType"><option value="PNT">PNT</option></select></label>
 </fieldset>}
 {revisionFields && <fieldset className="form-section"><legend>{revisionOnly ? "Revisión" : "Revisión inicial (solo si consta)"}</legend>
 <label>Revisión explícita<input name="revisionCode" defaultValue={value("revisionCode", revision?.revisionCode || "")} placeholder="00" maxLength={2}/></label>
 <p>00 es la revisión original. No se crean automáticamente revisiones anteriores.</p>
 <label>Motivo de revisión<textarea name="revisionReason" defaultValue={value("revisionReason", revision?.revisionReason || "")}/></label>
 {revisionOnly && <label>Revisión anterior<select name="previousRevisionId" defaultValue={value("previousRevisionId", revision?.previousRevisionId || "")}><option value="">No documentada</option>{revisions.filter(r => r.id !== revision?.id).map(r => <option key={r.id} value={r.id}>{r.revisionCode}</option>)}</select></label>}
 <label><input type="checkbox" name="existingDocument" checked={existing} onChange={e => setExisting(e.target.checked)}/> Registrar revisión documental ya existente</label>
 <p>El borrador queda en elaboración. El registro documental exige contraste con una fuente real; no constituye una aprobación en la aplicación.</p>
 <label>Fecha de vigencia<input type="date" name="effectiveFrom" defaultValue={value("effectiveFrom", iso(revision?.effectiveFrom))}/></label>
 <label>Fecha prevista de revisión<input type="date" name="reviewDueAt" defaultValue={value("reviewDueAt", iso(revision?.reviewDueAt))}/></label>
 <p>En un borrador, las fechas previstas no activan la revisión ni acreditan su aprobación.</p>
 {existing && <>
 <label>Estado documental existente<select name="existingStatus" defaultValue={value("existingStatus", "IN_FORCE")}><option value="IN_FORCE">Vigente</option><option value="OBSOLETE">Obsoleto</option><option value="ANNULLED">Anulado</option></select></label>
 <label>Fecha de obsolescencia<input type="date" name="obsoletedAt" defaultValue={value("obsoletedAt", iso(revision?.obsoletedAt))}/></label>
 <p>Validez general de cinco años según GC-00/001/03. Registra las fechas documentadas; las fechas ausentes no se inventan.</p>
 <label><input type="checkbox" name="verified" defaultChecked={value("verified") === "on"}/> He contrastado la revisión y su estado con la fuente documental</label>
 </>}
 <label>Referencia documental<textarea name="sourceReference" defaultValue={value("sourceReference", revision?.sourceReference || "")} placeholder="Ubicación o referencia de la fuente controlada"/></label>
 </fieldset>}
 {!revisionOnly && <label>Observaciones (opcional)<textarea name="observations" defaultValue={value("observations", master?.observations || "")}/></label>}
 <label>Responsable del registro<input name="actor" required defaultValue={value("actor")}/></label>
 <label>Motivo del registro o cambio<textarea name="changeReason" defaultValue={value("changeReason")} required={!!master || revisionOnly}/></label>
 <div className="form-actions">
 {!master && !revisionOnly && <button disabled={pending || existing} name="operation" value="DRAFT">Guardar borrador</button>}
 {master?.administrativeStatus === "DRAFT" && !revisionOnly && <button disabled={pending} name="operation" value="REGISTER">Completar y registrar PNT</button>}
 <button disabled={pending} name="operation" value={revisionOnly ? "REGISTER" : master ? "EDIT" : "REGISTER"}>{pending ? "Guardando…" : master && !revisionOnly ? "Guardar cambios" : revisionOnly ? "Guardar revisión" : "Registrar PNT"}</button>
 </div>
 </form>;
}
