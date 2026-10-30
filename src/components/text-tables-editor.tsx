"use client";
import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { MAX_TABLE_COLUMNS, MAX_TABLE_ROWS, MAX_TABLES_PER_FIELD, parsePastedTable, pasteIntoTable, textTablesInputName, type TextTable } from "@/lib/forms/text-tables";

const emptyTable = (): TextTable => ({ title: "", columns: ["", ""], rows: [["", ""], ["", ""]] });

/**
 * D-127: tablas de un texto largo. Se editan aquí y se envían con el formulario (campo oculto con las
 * tablas en JSON); el servidor las valida y se guardan con el botón Guardar, como el resto del texto.
 * Pegar celdas de Excel en una celda reparte las filas y columnas desde esa celda.
 */
export function TextTablesEditor({ field, fieldLabel, initial }: { field: string; fieldLabel: string; initial: TextTable[] }) {
  const [tables, setTables] = useState<TextTable[]>(initial);
  const update = (index: number, change: (table: TextTable) => TextTable) =>
    setTables((current) => current.map((table, position) => (position === index ? change(table) : table)));

  // Fila -1 es la cabecera.
  const setCell = (index: number, row: number, column: number, value: string) =>
    update(index, (table) => row < 0
      ? { ...table, columns: table.columns.map((cell, position) => (position === column ? value : cell)) }
      : { ...table, rows: table.rows.map((cells, position) => (position === row ? cells.map((cell, at) => (at === column ? value : cell)) : cells)) });

  const [truncated, setTruncated] = useState<number | null>(null);

  function paste(index: number, row: number, column: number, event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(text.replace(/\r?\n$/, ""))) return;
    event.preventDefault();
    const result = pasteIntoTable(tables[index], row, column, parsePastedTable(text));
    update(index, () => result.table);
    setTruncated(result.truncated ? index : null);
  }

  // Intro en una celda no envía el formulario (el guardado es explícito): pasa a la celda de debajo.
  function enter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const input = event.currentTarget;
    const cell = input.closest("td, th");
    const row = cell?.parentElement;
    const position = cell && row ? Array.from(row.children).indexOf(cell) : -1;
    const next = row?.tagName === "TR" ? (row.parentElement?.tagName === "THEAD" ? row.closest("table")?.querySelector("tbody tr") : row.nextElementSibling) : null;
    next?.children[position]?.querySelector<HTMLInputElement>("input")?.focus();
  }

  return (
    <div className="text-tables">
      {tables.map((table, index) => {
        const name = `${index + 1}.ª tabla de «${fieldLabel}»`;
        const cell = (row: number, column: number, value: string, label: string) => (
          <input
            type="text"
            value={value}
            aria-label={`${label} · ${name}`}
            onChange={(event) => setCell(index, row, column, event.target.value)}
            onPaste={(event) => paste(index, row, column, event)}
            onKeyDown={enter}
          />
        );
        return (
          <fieldset key={index} className="text-table-editor">
            <legend>{name}</legend>
            <label className="text-table-title">
              <span>Título *</span>
              <input type="text" value={table.title} maxLength={200} aria-required="true" onKeyDown={enter} onChange={(event) => update(index, (current) => ({ ...current, title: event.target.value }))} />
            </label>
            <div className="text-table-scroll">
              <table className="text-table-grid">
                <thead>
                  <tr>
                    {table.columns.map((value, column) => <th key={column}>{cell(-1, column, value, `Cabecera, columna ${column + 1}`)}</th>)}
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((cells, row) => (
                    <tr key={row}>
                      {cells.map((value, column) => <td key={column}>{cell(row, column, value, `Fila ${row + 1}, columna ${column + 1}`)}</td>)}
                      <td>
                        <button type="button" className="link-button" aria-label={`Quitar la fila ${row + 1} · ${name}`} onClick={() => update(index, (current) => ({ ...current, rows: current.rows.filter((_, at) => at !== row) }))}>Quitar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {truncated === index ? <p className="field-error" role="status">Lo pegado no cabía entero: como máximo {MAX_TABLE_COLUMNS} columnas y {MAX_TABLE_ROWS} filas.</p> : null}
            <div className="text-table-actions">
              <button type="button" className="button small" disabled={table.rows.length >= MAX_TABLE_ROWS} onClick={() => update(index, (current) => ({ ...current, rows: [...current.rows, Array(current.columns.length).fill("")] }))}>+ Fila</button>
              <button type="button" className="button small" disabled={table.columns.length >= MAX_TABLE_COLUMNS} onClick={() => update(index, (current) => ({ columns: [...current.columns, ""], rows: current.rows.map((cells) => [...cells, ""]), title: current.title }))}>+ Columna</button>
              <button type="button" className="button small" disabled={table.columns.length <= 1} onClick={() => update(index, (current) => ({ title: current.title, columns: current.columns.slice(0, -1), rows: current.rows.map((cells) => cells.slice(0, -1)) }))}>− Última columna</button>
              <button type="button" className="button danger small" onClick={() => setTables((current) => current.filter((_, at) => at !== index))}>Quitar tabla</button>
            </div>
          </fieldset>
        );
      })}
      <div className="text-tables-add">
        <button type="button" className="button small" disabled={tables.length >= MAX_TABLES_PER_FIELD} aria-label={`Añadir tabla en «${fieldLabel}»`} onClick={() => setTables((current) => [...current, emptyTable()])}>+ Añadir tabla</button>
        {tables.length ? <small className="muted-note">Para traer una tabla de Excel, copia sus celdas y pégalas (Ctrl+V) en la primera celda. Las tablas se numeran en todo el expediente y salen en el anexo, dentro de la casilla de este apartado.</small> : null}
      </div>
      <input type="hidden" name={textTablesInputName(field)} value={tables.length ? JSON.stringify(tables) : ""} />
    </div>
  );
}
