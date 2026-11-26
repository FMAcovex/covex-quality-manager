"use client";
import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CsrfField } from "@/components/csrf";
import type { ReadingActionState } from "./domain";

type Action = (state: ReadingActionState, formData: FormData) => Promise<ReadingActionState>;

/** D-141: formulario de una acción de lectura; muestra el error o el resultado y recarga la ficha. */
export function ReadingActionForm({ action, submitLabel, className = "inline-form", children, danger = false }: {
  action: Action; submitLabel: string; className?: string; children?: ReactNode; danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const router = useRouter();
  useEffect(() => { if (state.message && !state.error) router.refresh(); }, [state, router]);
  // Cada guardado correcto monta el formulario de nuevo: campos vacíos e identificador de petición nuevo.
  return <form key={state.formRevision ?? 0} action={formAction} className={className}>
    <CsrfField />
    {children}
    <button className={`button small${danger ? "" : " primary"}`} type="submit" disabled={pending}>{pending ? "Guardando…" : submitLabel}</button>
    {state.error ? <p className="form-feedback error" role="alert">{state.error}</p> : null}
    {state.message && !state.error ? <p className="form-feedback success" role="status">{state.message}</p> : null}
  </form>;
}

/** Elegir lectores: usuarios (con búsqueda) y departamentos enteros. */
export function ReaderPicker({ users, departments }: { users: Array<{ id: string; name: string }>; departments: Array<{ id: string; code: string; name: string }> }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? users.filter(user => user.name.toLowerCase().includes(q)) : users;
  }, [query, users]);
  return <div className="reading-picker">
    <fieldset className="field">
      <legend>Usuarios</legend>
      <input type="search" placeholder="Buscar por nombre" value={query} onChange={event => setQuery(event.target.value)} aria-label="Buscar usuarios" />
      <div className="reading-picker-list">
        {users.map(user => <label key={user.id} className="check-option" hidden={!visible.includes(user)}><input type="checkbox" name="userIds" value={user.id} /> {user.name}</label>)}
        {!visible.length ? <span className="muted-note">Ningún usuario coincide.</span> : null}
      </div>
    </fieldset>
    <fieldset className="field">
      <legend>Departamentos completos</legend>
      <div className="reading-picker-list">
        {departments.map(department => <label key={department.id} className="check-option"><input type="checkbox" name="departmentIds" value={department.id} /> {department.code} · {department.name}</label>)}
      </div>
      <small className="muted-note">Añade a los usuarios activos del departamento.</small>
    </fieldset>
    <label className="field"><span>Personas externas (sin usuario)</span><textarea name="externalNames" rows={3} placeholder="Una persona por línea" /><small className="muted-note">No reciben tarea; Garantía de Calidad marca su lectura.</small></label>
  </div>;
}
