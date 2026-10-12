"use client";
import { CsrfField } from "@/components/csrf";


import { authenticatedFetch } from "@/lib/auth/client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  RelationActionState,
  RelationTargetOption,
} from "@/lib/qms/relation-form-types";

const initialState: RelationActionState = { error: null, success: null };

type RelationSuggestion = {
  id: string;
  recordType: RelationTargetOption["value"];
  businessCode: string;
  displayLabel?: string;
  year: number | null;
};

const typeLabels: Record<RelationTargetOption["value"], string> = {
  DEVIATION: "Desviación",
  CAPA: "CAPA",
  COMPLAINT: "Reclamación",
  RETURN: "Devolución",
  AUDIT: "Auditoría",
};

export function OperationalRelationForm({
  action,
  title,
  codeLabel,
  codePlaceholder,
  buttonLabel,
  defaultActor,
  targetOptions,
  currentRecordId,
  currentRecordType,
  findingId,
}: {
  action: (
    state: RelationActionState,
    formData: FormData,
  ) => Promise<RelationActionState>;
  title: string;
  codeLabel: string;
  codePlaceholder?: string;
  buttonLabel: string;
  defaultActor: string;
  targetOptions: RelationTargetOption[];
  findingId?: string;
  currentRecordId: string;
  currentRecordType: RelationTargetOption["value"];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const showType = targetOptions.length > 1;
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState<RelationTargetOption["value"]>(
    targetOptions[0]?.value ?? "CAPA",
  );
  const [code, setCode] = useState("");
  const [targetRecordId, setTargetRecordId] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<RelationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = code.trim();
    if (!query) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          currentRecordId,
          currentType: currentRecordType,
          relatedType: selectedType,
          q: query,
        });
        if (findingId) params.set("findingId", findingId);
        const response = await authenticatedFetch(`/api/qms/relation-suggestions?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const data = (await response.json()) as { suggestions?: RelationSuggestion[] };
        setSuggestions(data.suggestions ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [code, currentRecordId, currentRecordType, selectedType, findingId]);

  useEffect(() => {
    setCode("");
    setTargetRecordId("");
    setSuggestions([]);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, [selectedType]);

  const open = focused && code.trim().length > 0;
  const activeSuggestion = useMemo(
    () => (activeIndex >= 0 ? suggestions[activeIndex] : null),
    [activeIndex, suggestions],
  );

  function chooseSuggestion(suggestion: RelationSuggestion) {
    setCode(suggestion.businessCode || suggestion.displayLabel || suggestion.id);
    setTargetRecordId(suggestion.id);
    setSuggestions([]);
    setActiveIndex(-1);
    setFocused(false);
  }

  return (
    <div className="relation-editor">
      <h3>{title}</h3>
      {state.error ? <div className="form-errors"><strong>{state.error}</strong></div> : null}
      {state.success ? <div className="form-success"><strong>{state.success}</strong></div> : null}
      <form action={formAction} className="inline-form relation-form"><CsrfField />
        <input type="hidden" name="targetRecordId" value={targetRecordId} />
        {showType ? (
          <label className="field">
            <span>Tipo de expediente</span>
            <select
              name="recordType"
              required
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value as RelationTargetOption["value"])}
            >
              {targetOptions.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="recordType" value={selectedType} />
        )}
        <label className="field relation-code-field">
          <span>{codeLabel}</span>
          <div className="relation-autocomplete">
            <input
              ref={inputRef}
              name="businessCode"
              value={code}
              placeholder={codePlaceholder}
              required
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={activeSuggestion ? `${listId}-${activeIndex}` : undefined}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => {
                if (document.activeElement !== inputRef.current) setFocused(false);
              }, 120)}
              onChange={(event) => {
                setCode(event.target.value);
                setTargetRecordId("");
                setActiveIndex(-1);
              }}
              onKeyDown={(event) => {
                if (!open || !suggestions.length) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((index) => Math.max(index - 1, 0));
                } else if (event.key === "Escape") {
                  setFocused(false);
                  setActiveIndex(-1);
                } else if (event.key === "Enter" && activeSuggestion) {
                  event.preventDefault();
                  chooseSuggestion(activeSuggestion);
                }
              }}
            />
            {open ? (
              <div className="search-suggestions relation-suggestions" id={listId} role="listbox">
                {loading ? (
                  <div className="search-no-results">Buscando expedientes activos…</div>
                ) : suggestions.length ? (
                  suggestions.map((suggestion, index) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      id={`${listId}-${index}`}
                      className={index === activeIndex ? "active" : ""}
                      key={suggestion.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => chooseSuggestion(suggestion)}
                    >
                      <strong>{suggestion.businessCode || suggestion.displayLabel || suggestion.id}</strong>
                      <span>{typeLabels[suggestion.recordType]}</span>
                      <small>{suggestion.year ?? ""}</small>
                    </button>
                  ))
                ) : (
                  <div className="search-no-results">
                    No hay expedientes activos compatibles que coincidan.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </label>
        <label className="field">
          <span>Registrado por</span>
          <input name="actor" defaultValue={defaultActor} required />
        </label>
        <div className="full">
          <button className="button primary" type="submit" disabled={pending}>
            {pending ? "Guardando…" : buttonLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
