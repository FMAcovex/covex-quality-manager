"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Acceso compacto al buscador global: un icono en la barra superior; Ctrl+K (⌘K) abre /search. */
export function GlobalSearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const field = document.getElementById("global-search-input") as HTMLInputElement | null;
        if (field) { field.focus(); field.select(); } else router.push("/search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return (
    <Link
      href="/search"
      className={`global-search-link ${pathname === "/search" ? "active" : ""}`}
      aria-label="Buscar en todos los módulos (Ctrl+K)"
      title="Buscar en todos los módulos (Ctrl+K)"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
    </Link>
  );
}
