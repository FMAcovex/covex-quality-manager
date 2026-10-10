"use client";
import { withReturnTo } from "../navigation";
import { useState, type FormEvent } from "react";
import { manualStateLabels, type ManualState } from "../manual-state/domain";

type Props = {
  returnTo?: string;
  documentId: string; revisionId: string; revisionCode: string;
  status: string; version: number; updatedAt: string; previousRevisionId: string | null;
  effectiveFrom: string | null; reviewDueAt: string | null;
};
export function ManualRevisionStatus({ returnTo, documentId, revisionId, revisionCode, status, version, updatedAt, previousRevisionId, effectiveFrom, reviewDueAt }: Props) {
  const [target, setTarget] = useState<ManualState>(
    status in manualStateLabels ? status as ManualState : "DRAFT",
  );
  const [reason, setReason] = useState("");
  const [effective, setEffective] = useState(effectiveFrom || "");
  const [due, setDue] = useState(reviewDueAt || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const readonly = status === "OBSOLETE" || status === "ANNULLED";
  const options = (Object.keys(manualStateLabels) as ManualState[]).filter(value => {
    if (readonly) return value === target;
    if (status === "IN_FORCE") return value === "IN_FORCE" || value === "OBSOLETE";
    return value !== "OBSOLETE";
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const request = {
        requestId: crypto.randomUUID(), expectedVersion: version, expectedUpdatedAt: updatedAt,
        targetStatus: target, reason: reason.trim(),
        ...(target === "IN_FORCE" ? { effectiveFrom: effective, ...(due ? { reviewDueAt: due } : {}), previousRevisionId } : {}),
      };
      const res = await fetch("/api/controlled-documents/" + documentId + "/revisions/" + revisionId + "/manual-status", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
      });
      const value = await res.json();
      if (!res.ok) throw new Error(value.error || "No se pudo cambiar el estado.");
      window.location.assign(withReturnTo("/controlled-documents/" + documentId + "?tab=information", returnTo));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo cambiar el estado."); }
    finally { setPending(false); }
  }
  return <form className="pnt-manual-status" onSubmit={submit}>
    <div className="pnt-manual-status-row">
      <label className="field"><span>Estado de la revisión {revisionCode}</span><select aria-label={"Estado de la revisión " + revisionCode} value={target} onChange={e => { setTarget(e.target.value as ManualState); setError(""); }} disabled={readonly}>{options.map(value => <option key={value} value={value}>{manualStateLabels[value]}</option>)}</select></label>
      {target === "IN_FORCE" && status !== "IN_FORCE" && <>
        <label className="field"><span>Fecha de vigencia real</span><input type="date" value={effective} onChange={e => setEffective(e.target.value)} required /></label>
        <label className="field"><span>Próxima revisión (si consta)</span><input type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
      </>}
    </div>
    {target !== status && !readonly && <>
      <label className="field"><span>Motivo y referencia de la decisión externa</span><textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={4000} required placeholder="Identifique la evidencia externa que acredita este estado" /></label>
      {target === "IN_FORCE" && previousRevisionId && <p className="section-help">Al confirmar, la revisión vigente anterior pasará automáticamente a obsoleta. No se eliminarán sus documentos.</p>}
      {target === "APPROVED_PENDING_EFFECTIVE" && <p className="section-help">Este registro declara una aprobación externa existente; no constituye una firma o aprobación electrónica.</p>}
      <div className="pnt-form-actions"><button className="button primary" disabled={pending || !reason.trim()}>{pending ? "Registrando..." : "Guardar estado manual"}</button></div>
    </>}
    {readonly && <p className="muted-note">Revisión histórica de solo lectura. Cree una nueva revisión para continuar.</p>}
    {error && <p role="alert" className="form-errors">{error}</p>}
  </form>;
}
