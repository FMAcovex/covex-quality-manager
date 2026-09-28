"use client";

import { useMemo, useState } from "react";
import type { ChangeFollowupTaskInput } from "@/modules/change-control/types";

type Department = { id: string; code: string; name: string };
type Task = {
  id: string;
  departmentId: string | null;
  departmentCodeSnapshot: string | null;
  description: string;
  responsible: string | null;
  plannedDate: Date | string | null;
  latestStatus?: "PENDING" | "COMPLETED" | "NOT_APPLICABLE";
  latestActualDate?: Date | string | null;
  latestEvidence?: string | null;
};

function dateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().slice(0, 10);
}

export function ChangeFollowupForm({
  action,
  departments,
  tasks,
  defaultResponsible,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  departments: Department[];
  tasks: Task[];
  defaultResponsible?: string | null;
  error?: string;
}) {
  const initial = useMemo<ChangeFollowupTaskInput[]>(
    () =>
      tasks.map<ChangeFollowupTaskInput>((item) => ({
        taskId: item.id,
        departmentId: item.departmentId ?? "",
        description: item.description,
        responsible: item.responsible ?? "",
        plannedDate: dateInput(item.plannedDate),
        status: item.latestStatus ?? "PENDING",
        actualDate: dateInput(item.latestActualDate),
        evidenceComment: item.latestEvidence ?? "",
        isNew: false,
      })),
    [tasks],
  );
  const [rows, setRows] = useState(initial);

  const patch = (index: number, value: Partial<ChangeFollowupTaskInput>) =>
    setRows((current) => current.map((item, i) => (i === index ? { ...item, ...value } : item)));

  return (
    <form action={action} className="followup-form">
      {error ? <div className="form-errors">{error}</div> : null}
      <input type="hidden" name="tasksJson" value={JSON.stringify(rows)} />
      <div className="form-grid">
        <label className="field">
          <span>Fecha del seguimiento *</span>
          <input type="date" name="followupDate" required />
        </label>
        <label className="field span-2">
          <span>Responsable de seguimiento *</span>
          <input name="responsible" defaultValue={defaultResponsible ?? ""} required />
        </label>
        <label className="field">
          <span>Estado de ejecución</span>
          <select name="executionStatus" defaultValue="NOT_EXECUTED">
            <option value="NOT_EXECUTED">No ejecutado</option>
            <option value="EXECUTED">Ejecutado</option>
          </select>
        </label>
        <label className="field">
          <span>Fecha de ejecución</span>
          <input type="date" name="executionDate" />
        </label>
        <label className="field">
          <span>Comprobación de eficacia</span>
          <select name="effectivenessStatus" defaultValue="PENDING">
            <option value="PENDING">Pendiente</option>
            <option value="ACCEPTABLE">Aceptable</option>
            <option value="NOT_ACCEPTABLE">No aceptable</option>
            <option value="NOT_APPLICABLE">No aplica · cierre sin ejecución</option>
          </select>
        </label>
        <label className="field span-2">
          <span>Observaciones de eficacia</span>
          <textarea name="effectivenessObservations" />
        </label>
      </div>

      <h3>Seguimiento de acciones y evidencias</h3>
      <div className="table-scroll">
        <table className="records-table followup-task-table">
          <thead>
            <tr>
              <th>Origen</th><th>Departamento</th><th>Acción</th><th>Responsable</th>
              <th>Prevista</th><th>Estado</th><th>Fecha real</th><th>Evidencia / comentario</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, index) => (
              <tr key={item.taskId ?? `new-${index}`} className={item.isNew ? "followup-new-task" : ""}>
                <td>{item.isNew ? <span className="badge new-task">NUEVA</span> : <span className="badge neutral">DICTAMEN</span>}</td>
                <td>
                  <select value={item.departmentId} disabled={!item.isNew} onChange={(e) => patch(index, { departmentId: e.target.value })}>
                    <option value="">—</option>
                    {departments.map((department) => <option key={department.id} value={department.id}>{department.code}</option>)}
                  </select>
                </td>
                <td><textarea value={item.description} disabled={!item.isNew} onChange={(e) => patch(index, { description: e.target.value })} /></td>
                <td><input value={item.responsible} disabled={!item.isNew} onChange={(e) => patch(index, { responsible: e.target.value })} /></td>
                <td><input type="date" value={item.plannedDate} disabled={!item.isNew} onChange={(e) => patch(index, { plannedDate: e.target.value })} /></td>
                <td>
                  <select value={item.status} onChange={(e) => patch(index, { status: e.target.value as ChangeFollowupTaskInput["status"] })}>
                    <option value="PENDING">Pendiente</option>
                    <option value="COMPLETED">Completada</option>
                    <option value="NOT_APPLICABLE">No aplica</option>
                  </select>
                </td>
                <td><input type="date" value={item.actualDate} onChange={(e) => patch(index, { actualDate: e.target.value })} /></td>
                <td><textarea value={item.evidenceComment} onChange={(e) => patch(index, { evidenceComment: e.target.value })} /></td>
                <td>
                  {item.isNew ? (
                    <button type="button" className="button danger small" onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>Quitar</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="button small"
        onClick={() =>
          setRows((current) => [
            ...current,
            {
              departmentId: "",
              description: "",
              responsible: "",
              plannedDate: "",
              status: "PENDING",
              actualDate: "",
              evidenceComment: "",
              isNew: true,
            } satisfies ChangeFollowupTaskInput,
          ])
        }
      >
        + Añadir nueva acción detectada en seguimiento
      </button>

      <div className="form-grid followup-close-grid">
        <label className="field span-3"><span>Observaciones generales</span><textarea name="observations" /></label>
        <label className="field">
          <span>¿Se cierra el cambio?</span>
          <select name="closeChange" defaultValue="false">
            <option value="false">No</option>
            <option value="true">Sí</option>
          </select>
        </label>
        <label className="field"><span>Próximo seguimiento</span><input type="date" name="nextFollowupDate" /></label>
        <label className="field span-2"><span>Si permanece abierto, motivo</span><textarea name="remainOpenReason" /></label>
        <label className="field span-3"><span>Motivo del cierre / conclusión</span><textarea name="conclusion" /></label>
        <label className="field"><span>Aprobación del cierre, si aplica</span><input name="approvalByText" /></label>
      </div>
      <div className="form-footer">
        <span className="muted-note">Las nuevas tareas quedarán marcadas y persistirán en los siguientes seguimientos.</span>
        <button className="button primary" type="submit">Guardar seguimiento</button>
      </div>
    </form>
  );
}
