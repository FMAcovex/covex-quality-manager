"use client";
import { useState } from "react";
import { permissions, assertTransition, type LifecycleCommand } from "../lifecycle/domain";
export type LifecycleFormProps = { documentId: string; revisionId: string; version: number; state: Parameters<typeof assertTransition>[1]; capabilities: string[];
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
  return <form className="form-section" onChange={() => setRequestId(null)} onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    const fd = new FormData(event.currentTarget), key = requestId || crypto.randomUUID(); setRequestId(key);
    const input: Record<string, unknown> = { requestId: key, expectedVersion: p.version, operation: selected, reason: fd.get("reason"), notes: fd.get("notes"), evidenceIds: fd.getAll("evidenceIds") };
    for (const name of ["result", "discrepancies", "referenceBasis", "function", "externalPerson", "responsibility", "authorityBasis", "accreditedDate", "registrationId", "rectifiesId", "effectiveFrom", "reviewDueAt", "finalDocumentId"]) if (fd.get(name)) input[name] = fd.get(name);
    if (selected === "ACTIVATE") input.previousRevisionId = p.previousId;
    if (selected === "PLAN") input.separationConfirmed = fd.get("separationConfirmed") === "on";
    try {
      const res = await fetch(`/api/controlled-documents/${p.documentId}/revisions/${p.revisionId}/lifecycle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await res.json(); if (!res.ok) { setError(result.error); setRequestId(null); } else window.location.assign(`/controlled-documents/${p.documentId}?tab=verification`);
    } catch { setError("No se pudo confirmar el resultado. Reintente sin cambiar datos para evitar duplicación."); } finally { setBusy(false); }
  }}>
    <label>Operación<select aria-label="Operación" value={selected} onChange={e => setOperation(e.target.value as LifecycleCommand["operation"])}>{available.map(op => <option key={op} value={op}>{labels[op]}</option>)}</select></label>
    <fieldset><legend>Evidencias concretas de esta revisión</legend>{p.objects.map(o => <label key={o.id}><input type="checkbox" name="evidenceIds" value={o.id}/>{o.originalName} ({o.kind}) {o.externalReference && "— referencia externa, sin custodia/hash"}</label>)}</fieldset>
    <label>Motivo<textarea name="reason" required maxLength={4000}/></label><label>Observaciones del contraste / fundamento de la operación<textarea name="notes" required maxLength={8000}/></label>
    <label>Fundamento de contraste de referencias externas (si se utilizan)<textarea name="referenceBasis" maxLength={4000}/></label>
    {selected === "VERIFY" && <><label>Resultado<select name="result"><option value="FAVORABLE">Favorable</option><option value="DISCREPANCY">Discrepancias: queda pendiente</option></select></label><label>Diferencias detectadas<textarea name="discrepancies" maxLength={8000}/></label></>}
    {selected === "REGISTER_EXTERNAL" && <><label>Función<select name="function">{(p.state === "PENDING_APPROVAL" ? ["APPROVAL"] : ["PREPARATION", "REVIEW"]).map(role => <option key={role} value={role}>{role === "PREPARATION" ? "Preparación" : role === "REVIEW" ? "Revisión" : "Aprobación"}</option>)}</select></label><label>Persona externa según documento<input name="externalPerson" required maxLength={200}/></label><label>Cargo / responsabilidad / ámbito<input name="responsibility" required maxLength={1000}/></label><label>Fundamento de autoridad conforme al PNT<textarea name="authorityBasis" required maxLength={4000}/></label><label>Fecha acreditada<input name="accreditedDate" type="date" required/></label><p>Esto registra evidencia; no acepta una aprobación ni cambia el estado.</p></>}
    {selected === "CONTRAST_EXTERNAL" && <><label>Registro externo<select name="registrationId" required><option value="">Seleccione</option>{p.decisions.filter(d => d.operation === "REGISTER_EXTERNAL").map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label><label>Resultado del contraste humano<select name="result"><option value="ACCEPTED">Aceptado</option><option value="INSUFFICIENT">Insuficiente</option><option value="REJECTED">Rechazado</option></select></label><p>Seleccione exactamente las evidencias del registro contrastado. Un tipo PDF firmado no valida una firma.</p></>}
    {selected === "PLAN" && <><label>Documento final controlado<select name="finalDocumentId" required><option value="">Seleccione</option>{p.objects.filter(o => ["DOCUMENT_PDF", "EXTERNAL_SIGNED_PDF"].includes(o.kind)).map(o => <option key={o.id} value={o.id}>{o.originalName}</option>)}</select></label><label>Entrada en vigor<input type="date" name="effectiveFrom" required/></label><label>Revisión prevista<input type="date" name="reviewDueAt" required/></label><label><input type="checkbox" name="separationConfirmed" required/>He contrastado que preparación y aprobación corresponden a personas distintas.</label></>}
    {selected === "ACTIVATE" && <p>Se confirma como revisión vigente anterior: {p.previousId || "ninguna"}. La operación retirará la anterior en la misma transacción.</p>}
    {selected === "RECTIFY" && <label>Decisión que se rectifica<select name="rectifiesId" required><option value="">Seleccione</option>{p.decisions.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>}
    {error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? "Registrando…" : "Registrar decisión explícita"}</button>
  </form>;
}
