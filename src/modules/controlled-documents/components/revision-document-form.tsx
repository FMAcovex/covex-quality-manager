"use client";
import { FormEvent, useState } from "react";
import { documentKinds } from "../documents/types";
// Separate from SignedVersionDocumentForm: multiple kinds/references, no upsert and no typed actor.
export function RevisionDocumentForm({ documentId, revisionId, documents }: { documentId: string; revisionId: string; documents: { id: string; originalName: string; kind: string }[] }) {
  const [error, setError] = useState<string | null>(null), [pending, setPending] = useState(false);
  const [mode, setMode] = useState("file");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setPending(true); setError(null);
    try {
      const response = await fetch(`/api/controlled-documents/${documentId}/revisions/${revisionId}/documents`, { method: "POST", body: form });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "No se pudo incorporar el documento.");
      // Full navigation after the committed response avoids an async action/revalidation tree retaining pending state.
      window.location.assign(`/controlled-documents/${documentId}?tab=documents`);
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo incorporar el documento."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="inline-form">
    {error && <p role="alert">{error}</p>}
    <label>Tipo documental<select aria-label="Tipo documental" name="kind" required>{Object.entries(documentKinds).map(([k, label]) => <option value={k} key={k}>{label}</option>)}</select></label>
    <label>Soporte<select aria-label="Soporte" name="mode" value={mode} onChange={e => setMode(e.target.value)}><option value="file">Archivo</option><option value="reference">Referencia externa</option></select></label>
    {mode === "file" ? <label>Archivo documental<input type="file" name="file" accept=".pdf,.docx,.xlsx" required /></label> : <><label>Nombre de referencia<input name="referenceName" maxLength={200} required /></label><label>URL documental HTTPS<input name="referenceUrl" type="url" maxLength={2000} required /></label></>}
    <label>Descripción / contexto de evidencia<textarea name="description" maxLength={2000} /></label>
    <label>Sustituye a<select aria-label="Sustituye a" name="replacesId"><option value="">Nuevo documento (sin sustitución)</option>{documents.map(d => <option key={d.id} value={d.id}>{documentKinds[d.kind as keyof typeof documentKinds]} — {d.originalName} — {d.id}</option>)}</select></label>
    <label>Motivo de sustitución<textarea name="replacementReason" maxLength={2000} /></label>
    <p>El responsable procede del acceso al servidor, no de un nombre escrito. La clasificación de evidencia o PDF firmado no acredita aprobación ni valida firmas.</p>
    <button className="button" disabled={pending}>{pending ? "Incorporando…" : "Añadir documento"}</button>
  </form>;
}
