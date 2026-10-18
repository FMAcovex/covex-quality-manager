"use client";
import { useState, type FormEvent } from "react";
import { ActorField, useCanAct } from "@/components/permissions";
import { CsrfField } from "@/components/csrf";
import { createIndexDepartmentsAction } from "@/modules/configuration/admin-actions";
import { indexDepartmentStatusLabels, type IndexDepartment } from "../preview/types";

/**
 * Departamentos del índice (D-097): los que faltan en Configuración se dan de alta de una vez con el
 * nombre de la cabecera de su hoja, editable. Los anulados en el índice no se dan de alta.
 */
export function IndexDepartments({ departments, onCreated }: { departments: IndexDepartment[]; onCreated: () => Promise<void> }) {
  const canConfigure = useCanAct("MANAGE_CONFIGURATION", "SYSTEM");
  const missing = departments.filter((d) => d.status === "MISSING");
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = missing.filter((d) => form.get(`include:${d.code}`) === "on").map((d) => ({ code: d.code, name: String(form.get(`name:${d.code}`) ?? "") }));
    form.set("departments", JSON.stringify(selected));
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await createIndexDepartmentsAction({ error: null, created: [], skipped: [] }, form);
      if (result.error) { setError(result.error); return; }
      setMessage(`Dados de alta: ${result.created.length}.${result.skipped.length ? ` Ya existían: ${result.skipped.join(", ")}.` : ""} Se vuelve a analizar el Excel con los departamentos nuevos.`);
      await onCreated();
    } catch (e) { setError(e instanceof Error ? e.message : "No se han podido dar de alta los departamentos."); }
    finally { setBusy(false); }
  }
  if (!departments.length) return null;
  return <section className="form-section index-departments">
    <h2>Departamentos del índice</h2>
    <p>Cada PNT se asocia al departamento de su código. Los que faltan en Configuración dejan sus filas fuera de la inclusión en bloque. Los anulados en el índice no se dan de alta.</p>
    <div className="table-scroll"><table className="records-table compact-table"><thead><tr><th>Código</th><th>Nombre en el índice</th><th>PNT</th><th>Situación</th></tr></thead><tbody>
      {departments.map((d) => <tr key={d.code}><td>{d.code}</td><td>{d.name ?? "—"}{d.existingName && d.existingName !== d.name ? <small className="muted-note"> · en Configuración: {d.existingName}</small> : null}</td><td>{d.pntRows}</td><td>{d.status ? indexDepartmentStatusLabels[d.status] : "—"}</td></tr>)}
    </tbody></table></div>
    {missing.length ? canConfigure ? <form onSubmit={submit} className="index-departments-form"><CsrfField />
      <h3>Dar de alta los que faltan ({missing.length})</h3>
      <p className="muted-note">Revisa el nombre de cada uno; se guarda tal como quede aquí y se puede cambiar después en Configuración.</p>
      {missing.map((d) => <div className="index-department-row" key={d.code}>
        <label className="checkbox-field"><input type="checkbox" name={`include:${d.code}`} defaultChecked /> {d.code}</label>
        <label className="field"><span>Nombre</span><input name={`name:${d.code}`} defaultValue={d.name ?? ""} required maxLength={200} /></label>
      </div>)}
      <label className="field"><span>Motivo / referencia</span><input name="reason" maxLength={500} defaultValue="Alta desde el índice de PNT de Garantía de Calidad" /></label>
      <ActorField type="hidden" name="actor" />
      {error ? <p role="alert">{error}</p> : null}
      <button className="button primary" disabled={busy}>{busy ? "Dando de alta…" : "Dar de alta los departamentos seleccionados"}</button>
    </form> : <p className="muted-note">Faltan {missing.length} departamentos. Dar de alta departamentos requiere el permiso de gestionar la configuración.</p> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
