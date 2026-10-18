"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ActorField } from "@/components/permissions";
import { CsrfField } from "@/components/csrf";
import { installTemplatesAction } from "@/modules/configuration/admin-actions";
import type { InstallLineStatus, TemplateInstallReport } from "@/modules/configuration/template-install-service";

const statusText: Record<InstallLineStatus, string> = { installed: "✓ Instalada", unchanged: "= Ya estaba", conflict: "✗ No sustituida", failed: "✗ Error" };

// «instalada» y «ya instalada» ya los dice el estado; el resto del mensaje sí aporta.
const detail = (line: TemplateInstallReport["lines"][number]) =>
  line.message === "instalada" || line.message === "ya instalada" ? "" : line.status === "installed" ? ` · ${line.message}` : `: ${line.message}`;

/**
 * «Instalar plantillas» (D-105): sube los ZIP de plantillas, el PNT de OOS o anexos sueltos y los
 * instala con el mismo catálogo de huellas que `pnpm templates:install`. Muestra el resultado por archivo.
 */
export function TemplateInstallForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [report, setReport] = useState<TemplateInstallReport | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    setBusy(true); setError(""); setReport(null);
    try {
      const result = await installTemplatesAction({ error: null, report: null }, new FormData(element));
      if (result.error) { setError(result.error); return; }
      setReport(result.report);
      element.reset();
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "No se han podido instalar las plantillas."); }
    finally { setBusy(false); }
  }
  return <div className="template-install">
    <form onSubmit={submit} className="template-install-form"><CsrfField />
      <label className="field">
        <span>ZIP de plantillas, PNT o anexos (.zip, .docx, .xlsx)</span>
        <input name="files" type="file" multiple required accept=".zip,.docx,.xlsx" />
      </label>
      <ActorField type="hidden" name="actor" />
      <button className="button primary" disabled={busy}>{busy ? "Instalando…" : "Instalar plantillas"}</button>
    </form>
    <p className="muted-note">Cada archivo se reconoce por su huella SHA-256, no por el nombre. Una versión ya instalada nunca se sustituye por otro archivo. Máximo 15 MB por envío.</p>
    {error ? <p className="field-error" role="alert">{error}</p> : null}
    {report ? <div role="status" className="template-install-result">
      {report.lines.length ? <ul>
        {report.lines.map((line) => <li key={`${line.label}-${line.versionCode}`} className={line.status === "conflict" || line.status === "failed" ? "field-error" : undefined}>
          <strong>{statusText[line.status]}</strong> · {line.label} · versión {line.versionCode}{detail(line)}
        </li>)}
      </ul> : <p>No se ha reconocido ninguna plantilla controlada.</p>}
      {report.unrecognized.length ? <details>
        <summary>Archivos no reconocidos: {report.unrecognized.length}</summary>
        <ul>{report.unrecognized.map((name) => <li key={name}>{name}</li>)}</ul>
        <p className="muted-note">No están en el catálogo de plantillas controladas y no se han instalado. Una revisión nueva de un anexo se registra con «Registrar nueva plantilla» y solo se activa si es compatible con la versión vigente.</p>
      </details> : null}
    </div> : null}
  </div>;
}
