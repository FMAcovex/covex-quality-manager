"use client";

import { useEffect, useMemo, useState } from "react";

export type ColumnPreference = {
  key: string;
  label: string;
  locked?: boolean;
  defaultVisible?: boolean;
};

export function ColumnSelector({
  tableId,
  storageKey,
  columns,
}: {
  tableId: string;
  storageKey: string;
  columns: ColumnPreference[];
}) {
  const defaults = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => [column.key, column.locked || column.defaultVisible !== false]),
      ) as Record<string, boolean>,
    [columns],
  );
  const [visible, setVisible] = useState<Record<string, boolean>>(defaults);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, boolean>;
        setVisible({ ...defaults, ...parsed });
      }
    } catch {
      setVisible(defaults);
    } finally {
      setReady(true);
    }
  }, [defaults, storageKey]);

  useEffect(() => {
    if (!ready) return;
    const table = document.getElementById(tableId);
    if (!table) return;

    for (const column of columns) {
      const show = column.locked || visible[column.key] !== false;
      table
        .querySelectorAll<HTMLElement>(`[data-column-key="${column.key}"]`)
        .forEach((cell) => {
          cell.hidden = !show;
        });
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(visible));
    } catch {
      // La preferencia visual es opcional; la tabla sigue funcionando sin almacenamiento local.
    }
  }, [columns, ready, storageKey, tableId, visible]);

  function reset() {
    setVisible(defaults);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Sin impacto funcional.
    }
  }

  return (
    <details className="column-menu">
      <summary className="button">Columnas ▾</summary>
      <div className="column-popover">
        <div className="column-popover-heading">
          <div>
            <strong>Columnas visibles</strong>
            <span>Solo cambia tu vista. No modifica el expediente ni los anexos.</span>
          </div>
          <button className="link-button" type="button" onClick={reset}>Restablecer</button>
        </div>
        <div className="column-options">
          {columns.map((column) => (
            <label key={column.key}>
              <input
                type="checkbox"
                checked={column.locked || visible[column.key] !== false}
                disabled={column.locked}
                onChange={(event) =>
                  setVisible((current) => ({
                    ...current,
                    [column.key]: event.target.checked,
                  }))
                }
              />
              <span>{column.label}</span>
              {column.locked ? <small>fija</small> : null}
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}
