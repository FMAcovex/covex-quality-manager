"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { csrfToken } from "@/lib/auth/client";
import { deleteListViewAction, saveListViewAction } from "@/lib/saved-views/actions";
import { SAVED_VIEW_NAME_MAX, normalizeViewQuery } from "@/lib/saved-views/domain";

type SavedView = { id: string; name: string; query: string };

/**
 * Vistas guardadas de un listado (preferencia personal, D-084). Guardado siempre
 * explícito: botón y nombre; sustituir o eliminar pide confirmación. Va dentro del
 * formulario GET de filtros, por eso sus controles no tienen `name` ni son `submit`.
 */
export function SavedViews({ listPath, views }: { listPath: string; views: SavedView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const current = () => normalizeViewQuery(window.location.search);
  const selected = () => views.find((view) => view.query === current());

  const open = (id: string) => {
    const view = views.find((item) => item.id === id);
    if (view) router.push(view.query ? `${listPath}?${view.query}` : listPath);
  };
  const save = () => {
    const name = window.prompt("Nombre de la vista (filtros actuales del listado):", selected()?.name ?? "")?.trim();
    if (!name) return;
    if (views.some((view) => view.name === name) && !window.confirm(`Ya existe la vista «${name}». ¿Sustituir sus filtros por los actuales?`)) return;
    start(async () => {
      const result = await saveListViewAction({ listPath, name: name.slice(0, SAVED_VIEW_NAME_MAX), query: window.location.search, _covexCsrf: csrfToken() });
      setMessage(result.ok ? `Vista «${name}» guardada.` : result.error);
      if (result.ok) router.refresh();
    });
  };
  const remove = () => {
    const view = selected();
    if (!view || !window.confirm(`¿Eliminar la vista «${view.name}»?`)) return;
    start(async () => {
      const result = await deleteListViewAction({ id: view.id, _covexCsrf: csrfToken() });
      setMessage(result.ok ? `Vista «${view.name}» eliminada.` : result.error);
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="saved-views" aria-busy={pending}>
      {views.length ? (
        <select aria-label="Vistas guardadas" value="" onChange={(event) => open(event.target.value)} disabled={pending}>
          <option value="">Vistas guardadas…</option>
          {views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
        </select>
      ) : null}
      <button className="button small" type="button" onClick={save} disabled={pending}>Guardar vista</button>
      {views.length ? <button className="button small" type="button" onClick={remove} disabled={pending} title="Elimina la vista que coincide con los filtros actuales">Eliminar vista</button> : null}
      {message ? <span className="muted-note" role="status">{message}</span> : null}
    </div>
  );
}
