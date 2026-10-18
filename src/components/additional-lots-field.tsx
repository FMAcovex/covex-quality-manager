"use client";
import { useState } from "react";
import type { AdditionalLot } from "@/lib/qms/additional-lots";

type Column = "name" | "lot" | "size" | "quantity";
type Row = { kind?: "PRODUCT" | "MATERIAL"; name: string; lot: string; size: string; quantity: string };

/**
 * Otros lotes afectados además del principal (D-094). Las columnas repiten las del lote
 * principal del módulo; en el anexo se imprimen en la misma casilla, uno por línea.
 */
export function AdditionalLotsField({
  defaultValue = [],
  labels,
  kinds,
  error,
}: {
  defaultValue?: readonly AdditionalLot[];
  /** Rótulo de cada columna visible; las que no se indican no se muestran. */
  labels: Partial<Record<Column, string>>;
  /** Desviaciones: el lote puede ser de producto o de material. */
  kinds?: Record<"PRODUCT" | "MATERIAL", string>;
  error?: string;
}) {
  const empty = (): Row => ({ ...(kinds ? { kind: "PRODUCT" as const } : {}), name: "", lot: "", size: "", quantity: "" });
  const [rows, setRows] = useState<Row[]>(defaultValue.map((lot) => ({ ...empty(), ...lot })));
  const columns = (Object.keys(labels) as Column[]);
  const update = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="field full additional-lots">
      <span>Otros lotes afectados</span>
      <input type="hidden" name="additionalLotsJson" value={JSON.stringify(rows)} />
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="dynamic-list">
        {rows.map((row, index) => (
          <div className="dynamic-row additional-lot-row" key={index}>
            {kinds ? (
              <label className="field">
                <span>Tipo</span>
                <select value={row.kind} onChange={(e) => update(index, { kind: e.target.value as Row["kind"] })}>
                  {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            ) : null}
            {columns.map((column) => (
              <label className="field" key={column}>
                <span>{labels[column]}{column === "lot" ? " *" : ""}</span>
                <input value={row[column]} maxLength={200} onChange={(e) => update(index, { [column]: e.target.value })} />
              </label>
            ))}
            <button type="button" className="button danger small" onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>Quitar</button>
          </div>
        ))}
        <div><button type="button" className="button small" onClick={() => setRows((current) => [...current, empty()])}>+ Añadir otro lote</button></div>
      </div>
      <small className="muted-note">El primer lote va en los campos de arriba. En el anexo impreso todos salen en la misma casilla, uno por línea.</small>
    </div>
  );
}
