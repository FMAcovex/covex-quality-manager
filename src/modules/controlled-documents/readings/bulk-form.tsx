"use client";
import { useMemo, useState } from "react";
import { ReaderPicker, ReadingActionForm } from "./forms";
import { bulkAddReadersAction } from "./actions";

/** Datos de un PNT que se puede elegir (calculados en el servidor). */
type Candidate = { id: string; baseCode: string; title: string; departmentId: string | null; department: string; inForce: string | null; approved: string | null };
type Department = { id: string; code: string; name: string };

/**
 * D-141, entrega 2: pedir la misma lectura en varios PNT a la vez. Cada PNT conserva sus lecturas en su
 * pestaña «Lectura»; los PNT sin la revisión elegida se omiten y el resultado lo dice.
 */
export function BulkReadingForm({ candidates, departments, users, today, due }: { candidates: Candidate[]; departments: Department[]; users: Array<{ id: string; name: string }>; today: string; due: string }) {
  return <ReadingActionForm action={bulkAddReadersAction} submitLabel="Pedir lectura" className="form-stack bulk-reading-form">
    <BulkPicker candidates={candidates} departments={departments} />
    <ReaderPicker users={users} departments={departments} />
    <label className="field compact"><span>Plazo</span><input type="date" name="dueDate" defaultValue={due} min={today} required /></label>
  </ReadingActionForm>;
}

function BulkPicker({ candidates, departments }: { candidates: Candidate[]; departments: Department[] }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [revision, setRevision] = useState<"IN_FORCE" | "APPROVED_PENDING_EFFECTIVE">("IN_FORCE");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter(c => (!department || c.departmentId === department) && (!q || c.baseCode.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)));
  }, [candidates, department, query]);
  const visibleIds = new Set(visible.map(c => c.id));
  const toggle = (id: string, on: boolean) => setSelected(current => { const next = new Set(current); if (on) next.add(id); else next.delete(id); return next; });
  const without = [...selected].filter(id => { const c = candidates.find(item => item.id === id); return c && !(revision === "IN_FORCE" ? c.inForce : c.approved); }).length;
  return <fieldset className="field bulk-reading-pnts">
    <legend>PNT</legend>
    <div className="bulk-reading-toolbar">
      <input type="search" placeholder="Buscar por código o título" value={query} onChange={event => setQuery(event.target.value)} aria-label="Buscar PNT" />
      <select value={department} onChange={event => setDepartment(event.target.value)} aria-label="Departamento del PNT">
        <option value="">Todos los departamentos</option>
        {departments.map(d => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
      </select>
      <button type="button" className="button small" onClick={() => setSelected(current => new Set([...current, ...visible.map(c => c.id)]))}>Elegir los {visible.length} visibles</button>
      <button type="button" className="button small" onClick={() => setSelected(new Set())} disabled={!selected.size}>Quitar selección</button>
    </div>
    <div className="bulk-reading-revision" role="radiogroup" aria-label="Revisión que se lee">
      <label className="check-option"><input type="radio" name="revisionStatus" value="IN_FORCE" checked={revision === "IN_FORCE"} onChange={() => setRevision("IN_FORCE")} /> Revisión vigente</label>
      <label className="check-option"><input type="radio" name="revisionStatus" value="APPROVED_PENDING_EFFECTIVE" checked={revision === "APPROVED_PENDING_EFFECTIVE"} onChange={() => setRevision("APPROVED_PENDING_EFFECTIVE")} /> Revisión aprobada pendiente de vigencia</label>
    </div>
    <p className="muted-note" data-testid="bulk-reading-selected">{selected.size === 1 ? "1 PNT elegido" : `${selected.size} PNT elegidos`}{without ? ` · ${without} sin esa revisión: se omitirá${without === 1 ? "" : "n"}` : ""}</p>
    <div className="bulk-reading-list">
      {candidates.map(c => {
        const code = revision === "IN_FORCE" ? c.inForce : c.approved;
        return <label key={c.id} className="check-option bulk-reading-item" hidden={!visibleIds.has(c.id)}>
          <input type="checkbox" name="documentIds" value={c.id} checked={selected.has(c.id)} onChange={event => toggle(c.id, event.target.checked)} />
          <span><strong>{c.baseCode}</strong> {c.title}<small className="muted-note">{c.department}{" · "}{code ? `Revisión ${code}` : revision === "IN_FORCE" ? "Sin revisión vigente" : "Sin revisión aprobada pendiente"}</small></span>
        </label>;
      })}
      {!visible.length ? <span className="muted-note">Ningún PNT coincide.</span> : null}
    </div>
  </fieldset>;
}
