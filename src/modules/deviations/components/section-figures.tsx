"use client";
import { useEffect, useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useCanAct } from "@/components/permissions";
import type { RecordEvidenceState } from "@/lib/qms/record-evidence-actions";
import { figureSectionLabel, type FigureSection } from "../figures";
import { FigureThumbs, type FigureView } from "./figure-thumbs";

const MAX_SIDE = 2400;

/**
 * La figura se vuelve a dibujar en el navegador: respeta la orientación de la foto, limita el tamaño
 * y quita los metadatos (ubicación, cámara…). Las capturas quedan en PNG; las fotos, en JPEG.
 */
async function normalizeImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  if (!blob) throw new Error("imagen");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return new File([blob], `figura-${stamp}.${type === "image/png" ? "png" : "jpg"}`, { type });
}

/**
 * D-125: figuras de un apartado de la desviación. Se pega (Ctrl+V) o se arrastra una imagen en el
 * apartado, se describe y se guarda con «Adjuntar figura» como evidencia del expediente (no se
 * sustituye ni se borra). No depende del botón Guardar del formulario.
 */
export function SectionFigures({ section, qmsRecordId, figures, action }: {
  section: FigureSection;
  qmsRecordId: string;
  figures: readonly FigureView[];
  action: (state: RecordEvidenceState, formData: FormData) => Promise<RecordEvidenceState>;
}) {
  const canAttach = useCanAct("ATTACH_DOCUMENT");
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<{ error?: string; success?: string }>({});
  const [busy, startTransition] = useTransition();
  const label = figureSectionLabel(section);

  async function accept(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setStatus({ error: "Solo se pueden añadir imágenes como figura." }); return; }
    try {
      const normalized = await normalizeImage(file);
      setPending((current) => { if (current) URL.revokeObjectURL(current.url); return { file: normalized, url: URL.createObjectURL(normalized) }; });
      setStatus({});
    } catch {
      setStatus({ error: "No se ha podido leer la imagen." });
    }
  }

  // Pegar una imagen en cualquier punto del apartado (también dentro de un campo de texto) la prepara como figura.
  useEffect(() => {
    const area = box.current?.closest("section.form-section");
    if (!area || !canAttach) return;
    const onPaste = (event: Event) => {
      const items = [...((event as ClipboardEvent).clipboardData?.items ?? [])];
      const image = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
      if (!image) return;
      event.preventDefault();
      void accept(image.getAsFile());
    };
    area.addEventListener("paste", onPaste);
    return () => area.removeEventListener("paste", onPaste);
  });
  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void accept(event.dataTransfer.files[0]);
  }

  function upload() {
    if (!pending) return;
    if (!description.trim()) { setStatus({ error: "Describe qué muestra la figura." }); return; }
    const form = box.current?.closest("form");
    const data = new FormData();
    data.set("_covexCsrf", (form?.querySelector<HTMLInputElement>('input[name="_covexCsrf"]')?.value) ?? "");
    data.set("_covexAuditRequestId", crypto.randomUUID());
    data.set("description", description.trim());
    data.set("reference", "");
    data.set("section", section);
    data.set("actor", "");
    data.set("file", pending.file);
    startTransition(async () => {
      const result = await action({ error: null, success: null }, data);
      if (result.error) { setStatus({ error: result.error }); return; }
      setPending(null);
      setDescription("");
      setStatus({ success: result.success ?? "Figura adjuntada." });
      router.refresh();
    });
  }

  return (
    <div className="field full section-figures" ref={box}>
      <span>Figuras de «{label}»</span>
      <FigureThumbs qmsRecordId={qmsRecordId} figures={figures} />
      {canAttach ? (
        <>
          <div className={`figure-drop${pending ? " has-image" : ""}`} tabIndex={0} role="group" aria-label={`Añadir figura a ${label}`}
            onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
            {pending ? (
              <div className="figure-pending">
                {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local antes de adjuntar */}
                <img src={pending.url} alt="Vista previa de la figura" />
                <label className="field">
                  <span>Qué muestra la figura *</span>
                  <input value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} />
                </label>
                <div className="figure-actions">
                  <button type="button" className="button primary small" disabled={busy} onClick={upload}>{busy ? "Adjuntando…" : "Adjuntar figura"}</button>
                  <button type="button" className="button small" disabled={busy} onClick={() => setPending(null)}>Descartar</button>
                </div>
              </div>
            ) : (
              <p className="muted-note">Pega una imagen (Ctrl+V) en este apartado, arrástrala aquí o <button type="button" className="link-button" onClick={() => picker.current?.click()}>elige un archivo</button>.</p>
            )}
            <input ref={picker} type="file" accept="image/*" hidden onChange={(event) => { void accept(event.target.files?.[0]); event.target.value = ""; }} />
          </div>
          <small className="muted-note">La figura se guarda al pulsar «Adjuntar figura», aparte del botón Guardar, como evidencia del expediente: no se sustituye ni se borra. Se numera en orden y sale en la hoja «Figuras» al final del Anexo III; en el texto puedes citarla («ver figura 2»).</small>
        </>
      ) : null}
      {status.error ? <p className="field-error" role="alert">{status.error}</p> : null}
      {status.success ? <p className="form-success-inline" role="status">{status.success}</p> : null}
    </div>
  );
}
