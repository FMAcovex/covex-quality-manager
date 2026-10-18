"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Buscador global en la barra superior: un campo discreto en el que se escribe y, al pulsar
 * Intro, se abren los resultados en /search. Ctrl+K (⌘K) lleva el foco al campo. En /search
 * no se muestra, porque la propia página tiene el campo de búsqueda.
 */
export function GlobalSearchBox() {
  const pathname = usePathname();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        const field = (document.getElementById("global-search-input") as HTMLInputElement | null) ?? input.current;
        if (!field) return;
        event.preventDefault();
        field.focus();
        field.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (pathname === "/search") return null;
  return (
    <form action="/search" method="get" role="search" className="topbar-search" aria-label="Buscar en todos los módulos">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input
        ref={input}
        name="q"
        type="search"
        placeholder="Buscar… (Ctrl+K)"
        aria-label="Buscar en todos los módulos (Ctrl+K)"
        title="Busca por código, lote, título o descripción en todos los módulos"
        minLength={2}
        maxLength={100}
        autoComplete="off"
        required
      />
    </form>
  );
}
