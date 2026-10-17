"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import type { ActiveFilterChip } from "@/lib/qms/list-filters";

/**
 * Cabecera de listado con menos ruido visual (piloto en Desviaciones): buscador y botón
 * «Filtros» en una fila, filtros aplicados como etiquetas y panel de filtros plegado.
 * Los controles del panel siguen dentro del formulario GET aunque esté plegado, así que
 * buscar conserva los filtros. Abierto/plegado es una preferencia de este navegador.
 */
export function ListFilterToolbar({
  storageKey,
  search,
  views,
  chips,
  clearHref,
  children,
}: {
  storageKey: string;
  search: ReactNode;
  views?: ReactNode;
  chips: ActiveFilterChip[];
  clearHref: string;
  children: ReactNode;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(window.localStorage.getItem(storageKey) === "open"); } catch { /* sin almacenamiento: plegado */ }
  }, [storageKey]);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { window.localStorage.setItem(storageKey, next ? "open" : "closed"); } catch { /* preferencia no guardada */ }
  };

  return <div className="list-toolbar">
    <div className="list-toolbar-row">
      {search}
      <button className="button" type="submit">Buscar</button>
      <button className={`button list-filter-toggle${chips.length ? " has-filters" : ""}`} type="button" aria-expanded={open} aria-controls={panelId} onClick={toggle}>
        Filtros{chips.length ? <span className="list-filter-count">{chips.length}</span> : null}<span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {views}
    </div>
    {chips.length ? <div className="list-filter-chips" aria-label="Filtros aplicados">
      {chips.map((chip) => <Link key={chip.key} className="list-filter-chip" href={chip.href} title="Quitar este filtro">{chip.label}<span aria-hidden="true">×</span></Link>)}
      <Link className="list-filter-clear" href={clearHref}>Limpiar filtros</Link>
    </div> : null}
    <div id={panelId} className="filter-panel operational" hidden={!open}>
      {children}
      <div className="filter-actions"><button className="button small" type="submit">Aplicar</button><Link className="button small" href={clearHref}>Limpiar</Link></div>
    </div>
  </div>;
}
