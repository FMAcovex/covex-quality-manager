"use client";

import { authenticatedFetch } from "@/lib/auth/client";

import { useEffect, useId, useRef, useState } from "react";
import type { CapaOriginInput } from "@/modules/capa/types";

type Suggestion = CapaOriginInput;

const typeLabel = (value: CapaOriginInput["recordType"]) =>
  value === "DEVIATION" ? "Desviación" : value === "AUDIT" ? "Auditoría" : "Reclamación";

export function CapaOriginSelector({
  value,
  onChange,
  currentRecordId,
  disabled = false,
}: {
  value: CapaOriginInput[];
  onChange: (value: CapaOriginInput[]) => void;
  currentRecordId?: string;
  disabled?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState<CapaOriginInput["recordType"]>("DEVIATION");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q || disabled) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          editable: "1",
          currentType: "CAPA",
          relatedType: selectedType,
          q,
        });
        if (currentRecordId) params.set("currentRecordId", currentRecordId);
        const response = await authenticatedFetch(`/api/qms/relation-suggestions?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const data = (await response.json()) as { suggestions?: Suggestion[] };
        const selected = new Set(value.map((item) => item.id));
        setSuggestions((data.suggestions ?? []).filter((item) => !selected.has(item.id)));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedType, currentRecordId, disabled, value]);

  function add(item: Suggestion) {
    if (!value.some((selected) => selected.id === item.id)) onChange([...value, item]);
    setQuery("");
    setSuggestions([]);
    inputRef.current?.focus();
  }

  return (
    <div className="field span-3">
      <span>Expedientes de origen</span>
      <small className="muted-note">Selecciona una o varias Desviaciones, Reclamaciones o Auditorías reales.</small>
      {value.length ? (
        <div className="relation-chips">
          {value.map((item) => (
            <span className="relation-chip removable" key={item.id}>
              <strong>{item.businessCode || item.displayLabel || `Auditoría · ${item.id.slice(0, 8)}`}</strong> · {typeLabel(item.recordType)}
              {!disabled ? (
                <button type="button" className="button small" onClick={() => onChange(value.filter((selected) => selected.id !== item.id))}>
                  Quitar
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
      {!disabled ? (
        <div className="inline-form relation-form">
          <label className="field">
            <span>Tipo</span>
            <select value={selectedType} onChange={(event) => { setSelectedType(event.target.value as CapaOriginInput["recordType"]); setQuery(""); }}>
              <option value="DEVIATION">Desviación</option>
              <option value="COMPLAINT">Reclamación</option><option value="AUDIT">Auditoría</option>
            </select>
          </label>
          <label className="field relation-code-field">
            <span>Buscar por código</span>
            <div className="relation-autocomplete">
              <input
                ref={inputRef}
                value={query}
                autoComplete="off"
                placeholder={selectedType === "DEVIATION" ? "D/GC-..." : selectedType === "AUDIT" ? "Código, objeto o referencia" : "REC-..."}
                role="combobox"
                aria-expanded={focused && Boolean(query.trim())}
                aria-controls={listId}
                onFocus={() => setFocused(true)}
                onBlur={() => window.setTimeout(() => setFocused(false), 120)}
                onChange={(event) => setQuery(event.target.value)}
              />
              {focused && query.trim() ? (
                <div className="search-suggestions relation-suggestions" id={listId} role="listbox">
                  {loading ? <div className="search-no-results">Buscando expedientes…</div> : suggestions.length ? (
                    suggestions.map((item) => (
                      <button type="button" role="option" aria-selected="false" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => add(item)}>
                        <strong>{item.businessCode || item.displayLabel || `Auditoría · ${item.id.slice(0, 8)}`}</strong>
                        <span>{typeLabel(item.recordType)}</span>
                        <small>{item.year ?? ""}</small>
                      </button>
                    ))
                  ) : <div className="search-no-results">No hay expedientes activos compatibles que coincidan.</div>}
                </div>
              ) : null}
            </div>
          </label>
        </div>
      ) : null}
    </div>
  );
}
