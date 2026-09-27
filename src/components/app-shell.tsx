"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const modules = [
  { label: "Inicio", href: "/", enabled: true, match: "/" },
  { label: "Desviaciones", href: "/deviations", enabled: true, match: "/deviations" },
  { label: "CAPA", href: "/capa", enabled: true, match: "/capa" },
  { label: "Controles de cambios", href: "/changes", enabled: true, match: "/changes" },
  { label: "Reclamaciones", href: "#", enabled: false, match: "/complaints" },
  { label: "Devoluciones", href: "#", enabled: false, match: "/returns" },
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

        <div className="actor pilot-mode">
          <span className="avatar">V1</span>
          <span>
            <strong>Modo piloto</strong>
            <small>Identificación manual</small>
          </span>
        </div>
      </header>
      <main className="page-shell">{children}</main>
    </div>
  );
}
