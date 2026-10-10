"use client";
import { withReturnTo } from "../navigation";
import { FormEvent, useState } from "react";
import { documentKinds } from "../documents/types";
// Only the presentation changes: P2A continues to validate, store and preserve each document.
export function RevisionDocumentForm({ returnTo, documentId, revisionId, documents }: { returnTo?: string; documentId: string; revisionId: string; documents: { id: string; originalName: string; kind: string }[] }) {
  const [error, setError] = useState<string | null>(null), [pending, setPending] = useState(false);
  const [mode, setMode] = useState("file"), [kind, setKind] = useState("WORKING_WORD"), [replacesId, setReplacesId] = useState("");
  const eligible = documents.filter(d => d.kind === kind);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setPending(true); setError(null);
    try {
      if (replacesId && !String(form.get("replacementReason") || "").trim()) {
        setError("Indique el motivo de sustitución antes de reemplazar un documento.");
        setPending(false);
        return;
      }
      const response = await fetch("/api/controlled-documents/" + documentId + "/revisions/" + revisionId + "/documents", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo incorporar el documento.");
      window.location.assign(withReturnTo("/controlled-documents/" + documentId + "?tab=documents", returnTo));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo incorporar el documento."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="form-section pnt-document-form">
    <h4>Incorporar documento o evidencia</h4>
    {error && <p role="alert" className="form-errors">{error}</p>}
    <div className="pnt-inner-grid">
      <label className="field"><span>Tipo documental</span><select aria-label="Tipo documental" name="kind" value={kind} required onChange={e => { setKind(e.target.value); setReplacesId(""); }}>{Object.entries(documentKinds).map(([k, label]) => <option value={k} key={k}>{label}</option>)}</select></label>
      <label className="field"><span>Soporte</span><select aria-label="Soporte" name="mode" value={mode} onChange={e => setMode(e.target.value)}><option value="file">Archivo</option><option value="reference">Referencia externa</option></select></label>
      {mode === "file"
        ? <label className="field full"><span>Archivo documental</span><input type="file" name="file" accept=".pdf,.docx,.xlsx" required /></label>
        : <>
          <label className="field"><span>Nombre de referencia</span><input name="referenceName" maxLength={200} required /></label>
          <label className="field"><span>URL documental HTTPS</span><input name="referenceUrl" type="url" maxLength={2000} required /></label>
        </>}
      <label className="field full"><span>Descripción / contexto de evidencia</span><textarea name="description" maxLength={2000} /></label>
      <label className="field"><span>Sustituye a</span><select aria-label="Sustituye a" name="replacesId" value={replacesId} onChange={e => setReplacesId(e.target.value)}><option value="">Nuevo documento (sin sustitución)</option>{eligible.map(d => <option key={d.id} value={d.id}>{documentKinds[d.kind as keyof typeof documentKinds]} — {d.originalName}</option>)}</select></label>
      {replacesId && <label className="field"><span>Motivo de sustitución (obligatorio)</span><textarea name="replacementReason" maxLength={2000} required /></label>}
    </div>
    <p className="section-help">La identidad del responsable procede del acceso al servidor. Incorporar un PDF firmado o una evidencia no verifica las firmas ni aprueba el PNT.</p>
    <div className="pnt-form-actions"><button className="button primary" disabled={pending}>{pending ? "Incorporando…" : "Añadir documento"}</button></div>
  </form>;
}
