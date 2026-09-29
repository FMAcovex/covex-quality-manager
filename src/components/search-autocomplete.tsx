"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type SearchSuggestion = {
  id: string;
  href: string;
  code: string;
  title: string;
  meta?: string;
  searchText: string;
};

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

export function SearchAutocomplete({
  name = "q",
  defaultValue = "",
  placeholder,
  suggestions,
  limit = 6,
}: {
  name?: string;
  defaultValue?: string;
  placeholder: string;
  suggestions: SearchSuggestion[];
  limit?: number;
}) {
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const matches = useMemo(() => {
    const query = normalized(value.trim());
    if (!query) return [];

    return suggestions
      .map((suggestion) => {
        const code = normalized(suggestion.code);
        const haystack = normalized(suggestion.searchText);
        const score =
          code === query ? 0 :
          code.startsWith(query) ? 1 :
          code.includes(query) ? 2 :
          haystack.includes(query) ? 3 :
          99;
        return { suggestion, score };
      })
      .filter((item) => item.score < 99)
      .sort((a, b) => a.score - b.score || a.suggestion.code.localeCompare(b.suggestion.code, "es"))
      .slice(0, limit)
      .map((item) => item.suggestion);
  }, [limit, suggestions, value]);

  const open = focused && value.trim().length > 0;

  return (
    <div className="search-autocomplete">
      <input
        type="search"
        name={name}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        onChange={(event) => {
          setValue(event.target.value);
          setActiveIndex(-1);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onKeyDown={(event) => {
          if (!open || !matches.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === "Escape") {
            setFocused(false);
            setActiveIndex(-1);
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            router.push(matches[activeIndex].href);
          }
        }}
      />

      {open ? (
        <div className="search-suggestions" id={listId} role="listbox">
          {matches.length ? (
            matches.map((suggestion, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                id={`${listId}-${index}`}
                className={index === activeIndex ? "active" : ""}
                key={suggestion.id}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => router.push(suggestion.href)}
              >
                <strong>{suggestion.code}</strong>
                <span>{suggestion.title}</span>
                {suggestion.meta ? <small>{suggestion.meta}</small> : null}
              </button>
            ))
          ) : (
            <div className="search-no-results">No hay coincidencias inmediatas. Pulsa Buscar para realizar la búsqueda completa.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
