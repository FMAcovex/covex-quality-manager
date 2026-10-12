"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SessionControls } from "./session-controls";

const modules = [
  { label: "Inicio", href: "/", enabled: true, match: "/" },
  { label: "Desviaciones", href: "/deviations", enabled: true, match: "/deviations" },
  { label: "CAPA", href: "/capa", enabled: true, match: "/capa" },
  { label: "Controles de cambios", href: "/changes", enabled: true, match: "/changes" },
  { label: "Reclamaciones", href: "/complaints", enabled: true, match: "/complaints" },
  { label: "Devoluciones", href: "/returns", enabled: true, match: "/returns" },
  { label: "Auditorías", href: "/audits", enabled: true, match: "/audits" },
  { label: "Documentación controlada", href: "/controlled-documents", enabled: true, match: "/controlled-documents" },
  { label: "Configuración", href: "/settings", enabled: true, match: "/settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-frame">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">C</span>
          <span>
            <strong>COVEX</strong>
            <small>Gestión del Sistema de Calidad</small>
          </span>
        </Link>

        <nav className="module-nav" aria-label="Módulos QMS">
          {modules.map((module) => {
            const active =
              module.match === "/"
                ? pathname === "/"
                : pathname.startsWith(module.match);

            return module.enabled ? (
              <Link
                key={module.label}
                href={module.href}
                prefetch={module.href === "/controlled-documents" ? false : undefined}
                onNavigate={module.href === "/controlled-documents" ? (event) => {
                  event.preventDefault();
                  window.location.assign(module.href);
                } : undefined}
                className={`module-link ${active ? "active" : ""}`}
              >
                {module.label}
              </Link>
            ) : (
              <span
                key={module.label}
                className="module-link disabled"
                aria-disabled="true"
                title="Pendiente de diseño"
              >
                {module.label}
              </span>
            );
          })}
        </nav>

        <SessionControls />
      </header>
      <main className="page-shell">{children}</main>
    </div>
  );
}
