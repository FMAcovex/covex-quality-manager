"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SessionControls } from "./session-controls";
import { GlobalSearchBox } from "./global-search-box";
import { NavigationProgress } from "./navigation-progress";
import { useCanAct } from "./permissions";
import { qmsModules } from "@/modules/registry";

// Los módulos QMS salen del registro (docs/MODULE_CONTRACT.md); Inicio, Audit
// Trail y Configuración son entradas transversales.
const modules = [
  { label: "Inicio", href: "/", enabled: true, match: "/" },
  ...qmsModules.map((contract) => ({ label: contract.labels.plural, href: contract.href, enabled: true, match: contract.href })),
  { label: "Audit Trail", href: "/audit-trail", enabled: true, match: "/audit-trail" },
  { label: "Configuración", href: "/settings", enabled: true, match: "/settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const canReadSettings = useCanAct("READ", "SYSTEM");
  // Entrega 1 (D-117): antes de entrar no se ofrecen módulos ni búsqueda.
  const signIn = pathname === "/login";

  return (
    <div className="app-frame">
      <NavigationProgress />
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">C</span>
          <span>
            <strong>COVEX</strong>
            <small>Gestión del Sistema de Calidad</small>
          </span>
        </Link>

        {signIn ? null : <nav className="module-nav" aria-label="Módulos QMS">
          {modules.map((module) => {
            if (module.href === "/settings" && !canReadSettings) return null;
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
        </nav>}

        {signIn ? null : <div className="topbar-tools">
          <GlobalSearchBox />
          <SessionControls />
        </div>}
      </header>
      <main className="page-shell">{children}</main>
    </div>
  );
}
