import Link from "next/link";
import type { ReactNode } from "react";

const modules = [
  { label: "Desviaciones", href: "/deviations", enabled: true },
  { label: "CAPA", href: "#", enabled: false },
  { label: "Controles de cambios", href: "#", enabled: false },
  { label: "Reclamaciones", href: "#", enabled: false },
  { label: "Devoluciones", href: "#", enabled: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame">
      <header className="topbar">
        <Link className="brand" href="/deviations">
          <span className="brand-mark">C</span>
          <span>
            <strong>COVEX</strong>
            <small>Gestión del Sistema de Calidad</small>
          </span>
        </Link>

        <nav className="module-nav" aria-label="Módulos QMS">
          {modules.map((module) =>
            module.enabled ? (
              <Link key={module.label} href={module.href} className="module-link active">
                {module.label}
              </Link>
            ) : (
              <span
                key={module.label}
                className="module-link disabled"
                aria-disabled="true"
                title="Disponible en un hito posterior"
              >
                {module.label}
              </span>
            ),
          )}
        </nav>

        <div className="actor">
          <span className="avatar">UD</span>
          <span>
            <strong>Usuario demo</strong>
            <small>Identidad provisional</small>
          </span>
        </div>
      </header>
      <main className="page-shell">{children}</main>
    </div>
  );
}
