"use client";
import { CsrfField } from "@/components/csrf";


import { authenticatedFetch } from "@/lib/auth/client";
import { withReturnTo } from "../navigation";
import { useState } from "react";
import { permissions, assertTransition, type LifecycleCommand } from "../lifecycle/domain";
export type LifecycleFormProps = { returnTo?: string; documentId: string; revisionId: string; version: number; state: Parameters<typeof assertTransition>[1]; capabilities: string[];
  objects: { id: string; originalName: string; kind: string; externalReference: string | null }[];
  decisions: { id: string; operation: string; label: string; evidenceIds: string[] }[]; previousId: string | null };
const labels: Record<LifecycleCommand["operation"], string> = { VERIFY: "Verificar documentos", REGISTER_EXTERNAL: "Registrar función/ aprobación externa", CONTRAST_EXTERNAL: "Contrastar evidencia externa", SUBMIT: "Pasar a pendiente de aprobación", PLAN: "Registrar aprobación y planificar vigencia", ACTIVATE: "Activar vigencia explícitamente", RETIRE: "Declarar obsoleta", ANNUL: "Anular revisión", RECTIFY: "Rectificar decisión (sin eliminarla)" };
export function LifecycleForm(p: LifecycleFormProps) {
  const [operation, setOperation] = useState<LifecycleCommand["operation"]>("VERIFY"), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const available = (Object.keys(labels) as LifecycleCommand["operation"][]).filter(op => {
    if (!p.capabilities.includes(permissions[op])) return false;
    try { assertTransition(op, p.state, p.state === "PENDING_APPROVAL" ? "APPROVAL" : "PREPARATION"); return true; } catch { return false; }
  });
  const selected = available.includes(operation) ? operation : available[0];
  if (!selected) return <p>Sin operaciones autorizadas en este estado.</p>;
  return <form className="form-section pnt-lifecycle-form" onChange={() => setRequestId(null)} onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    const fd = new FormData(event.currentTarget), key = requestId || crypto.randomUUID(); setRequestId(key);
    if (!fd.getAll("evidenceIds").length) { setError("Seleccione al menos un documento o evidencia de esta revisión antes de continuar."); setRequestId(null); setBusy(false); return; }
    const input: Record<string, unknown> = { requestId: key, expectedVersion: p.version, operation: selected, reason: fd.get("reason"), notes: fd.get("notes"), evidenceIds: fd.getAll("evidenceIds") };
    for (const name of ["result", "discrepancies", "referenceBasis", "function", "externalPerson", "responsibility", "authorityBasis", "accreditedDate", "registrationId", "rectifiesId", "effectiveFrom", "reviewDueAt", "finalDocumentId"]) if (fd.get(name)) input[name] = fd.get(name);
    if (selected === "ACTIVATE") input.previousRevisionId = p.previousId;
    if (selected === "PLAN") input.separationConfirmed = fd.get("separationConfirmed") === "on";
    try {
      const res = await authenticatedFetch(`/api/controlled-documents/${p.documentId}/revisions/${p.revisionId}/lifecycle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await res.json(); if (!res.ok) { setError(result.error || "La decisión no se ha registrado. Compruebe las evidencias y los datos indicados."); setRequestId(null); } else window.location.assign(withReturnTo(`/controlled-documents/${p.documentId}?tab=verification`, p.returnTo));
    } catch { setError("No se pudo confirmar el resultado. Reintente sin cambiar datos para evitar duplicación."); } finally { setBusy(false); }
  }}><CsrfField />
    <h4>Registrar una decisión sobre esta revisión</h4><label className="field"><span>Operación</span><select aria-label="Operación" value={selected} onChange={e => setOperation(e.target.value as LifecycleCommand["operation"])}>{available.map(op => <option key={op} value={op}>{labels[op]}</option>)}</select></label>
    <fieldset className="pnt-evidence-fieldset"><legend>Evidencias concretas de esta revisión (seleccione al menos una)</legend>{p.objects.length === 0 && <p role="note">No hay documentos incorporados. Añada primero un documento en la pestaña Documentos.</p>}{p.objects.map(o => <label className="pnt-check" key={o.id}><input type="checkbox" name="evidenceIds" value={o.id}/><span>{o.originalName} ({o.kind}) {o.externalReference && "— referencia externa, sin custodia/hash"}</span></label>)}</fieldset><div className="pnt-inner-grid">
    <label className="field"><span>Motivo</span><textarea name="reason" required maxLength={4000}/></label><label className="field"><span>Observaciones del contraste / fundamento de la operación</span><textarea name="notes" required maxLength={8000}/></label>
    <label className="field full"><span>Fundamento de contraste de referencias externas (si se utilizan)</span><textarea name="referenceBasis" maxLength={4000}/></label>
    {selected === "VERIFY" && <><label className="field"><span>Resultado</span><select name="result"><option value="FAVORABLE">Favorable</option><option value="DISCREPANCY">Discrepancias: queda pendiente</option></select></label><label className="field"><span>Diferencias detectadas</span><textarea name="discrepancies" maxLength={8000}/></label></>}
    {selected === "REGISTER_EXTERNAL" && <><label className="field"><span>Función</span><select name="function">{(p.state === "PENDING_APPROVAL" ? ["APPROVAL"] : ["PREPARATION", "REVIEW"]).map(role => <option key={role} value={role}>{role === "PREPARATION" ? "Preparación" : role === "REVIEW" ? "Revisión" : "Aprobación"}</option>)}</select></label><label className="field"><span>Persona externa según documento</span><input name="externalPerson" required maxLength={200}/></label><label className="field"><span>Cargo / responsabilidad / ámbito</span><input name="responsibility" required maxLength={1000}/></label><label className="field"><span>Fundamento de autoridad conforme al PNT</span><textarea name="authorityBasis" required maxLength={4000}/></label><label className="field"><span>Fecha acreditada</span><input name="accreditedDate" type="date" required/></label><p className="section-help full">Esto registra evidencia; no acepta una aprobación ni cambia el estado.</p></>}
    {selected === "CONTRAST_EXTERNAL" && <><label className="field"><span>Registro externo</span><select name="registrationId" required><option value="">Seleccione</option>{p.decisions.filter(d => d.operation === "REGISTER_EXTERNAL").map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label><label className="field"><span>Resultado del contraste humano</span><select name="result"><option value="ACCEPTED">Aceptado</option><option value="INSUFFICIENT">Insuficiente</option><option value="REJECTED">Rechazado</option></select></label><p className="section-help full">Seleccione exactamente las evidencias del registro contrastado. Un tipo PDF firmado no valida una firma.</p></>}
    {selected === "PLAN" && <><label className="field"><span>Documento final controlado</span><select name="finalDocumentId" required><option value="">Seleccione</option>{p.objects.filter(o => ["DOCUMENT_PDF", "EXTERNAL_SIGNED_PDF"].includes(o.kind)).map(o => <option key={o.id} value={o.id}>{o.originalName}</option>)}</select></label><label className="field"><span>Entrada en vigor</span><input type="date" name="effectiveFrom" required/></label><label className="field"><span>Revisión prevista</span><input type="date" name="reviewDueAt" required/></label><label className="pnt-check full"><input type="checkbox" name="separationConfirmed" required/>He contrastado que preparación y aprobación corresponden a personas distintas.</label></>}
    {selected === "ACTIVATE" && <p className="section-help full">Se confirma como revisión vigente anterior: {p.previousId || "ninguna"}. La operación retirará la anterior en la misma transacción.</p>}
    {selected === "RECTIFY" && <label className="field"><span>Decisión que se rectifica</span><select name="rectifiesId" required><option value="">Seleccione</option>{p.decisions.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>}
    </div>{error && <p role="alert" className="form-errors">{error}</p>}<div className="pnt-form-actions"><button className="button primary" disabled={busy || p.objects.length === 0}>{busy ? "Registrando…" : labels[selected]}</button></div>
  </form>;
}
