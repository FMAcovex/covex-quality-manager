import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { displayDate, verificationLabels } from "../domain";
import { documentKinds } from "../documents/types";
import { documentPrincipal } from "../documents/access";
import { metadataSelection } from "../documents/service";
import { RevisionDocumentForm } from "./revision-document-form";
import type { ControlledDocumentRevision } from "@prisma/client";
export async function RevisionDocuments({ returnTo, documentId, revisions, annulled }: { returnTo?: string; documentId: string; revisions: ControlledDocumentRevision[]; annulled: boolean }) {
  let principal;
  try { principal = documentPrincipal(await headers()); } catch { return <div><h2>Documentos por revisión</h2><p role="alert">Acceso documental no autorizado o sin configurar. El nombre de responsable no autentica al usuario.</p></div>; }
  const objects = await prisma.controlledRevisionDocument.findMany({ where: { documentId }, orderBy: [{ incorporatedAt: "desc" }, { id: "desc" }], select: metadataSelection });
  return <div><h2>Documentos por revisión</h2><p>Historial íntegro: cada sustitución conserva el elemento anterior. Adjuntar no aprueba, publica ni verifica el PNT.</p>
    {!revisions.length && <p>No hay revisiones documentadas.</p>}
    {revisions.map(r => {
      const docs = objects.filter(d => d.revisionId === r.id);
      return <article className="form-section" key={r.id} data-revision-id={r.id}><h3>Revisión {r.revisionCode}</h3>
        <p>{verificationLabels[r.verificationStatus]}</p>{r.verificationStatus !== "VERIFIED" && <p role="note">Advertencia: revisión pendiente de verificación documental. Los archivos y evidencias aportados no acreditan aprobación.</p>}
        <p style={{ whiteSpace: "pre-wrap" }}>{r.sourceReference || "Sin referencia registrada"}</p>
        {!docs.length && <p>Sin documentos incorporados.</p>}
        {docs.map(d => <section key={d.id} className="form-section pnt-document-item"><h4>{documentKinds[d.kind as keyof typeof documentKinds]}</h4>
          <p className="pnt-document-name">{d.originalName} — {d.replacement ? "Sustituido (original conservado)" : d.state === "WORKING" ? "En elaboración — no aprobado" : "Registrado — sin verificación"}</p>
          <p>{displayDate(d.incorporatedAt)} — {d.incorporatedBy} ({d.identitySource})</p>
          <details className="pnt-technical-data"><summary>Detalles técnicos del documento</summary><dl><dt>UUID</dt><dd>{d.id}</dd><dt>Revisión UUID</dt><dd>{d.revisionId}</dd><dt>MIME / tamaño</dt><dd>{d.mimeType || "Referencia externa (sin binario custodiado)"} / {d.sizeBytes ?? "No comprobado"}</dd><dt>SHA-256</dt><dd>{d.sha256 || "No comprobado: referencia externa"}</dd><dt>Referencia de almacenamiento</dt><dd>{d.storageReference}</dd><dt>Contexto</dt><dd>{d.description || "—"}</dd></dl></details>
          {d.replacesId && <p>Sustituye a {d.replacesId}. Motivo: {d.replacementReason}</p>}
          {d.externalReference ? <a href={d.externalReference} target="_blank" rel="noopener noreferrer">Abrir referencia externa</a> : <a href={`/api/controlled-documents/${documentId}/revisions/${r.id}/documents/${d.id}`}>Descargar {d.originalName}</a>}
        </section>)}
        {principal.canWrite && !annulled && <RevisionDocumentForm returnTo={returnTo} documentId={documentId} revisionId={r.id} documents={docs.filter(d => !d.replacement)} />}
      </article>;
    })}
  </div>;
}
