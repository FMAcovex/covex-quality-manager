import Link from "next/link";

const modules = [
  {
    name: "Desviaciones",
    eyebrow: "GC-00/023",
    description: "Registro, investigación, acciones, seguimiento, documentos e indicadores.",
    href: "/deviations",
    status: "Operativo",
    tone: "ready",
    sections: ["Expedientes", "Investigación", "Acciones", "Seguimientos", "Documentos", "Indicadores"],
  },
  {
    name: "CAPA",
    eyebrow: "GC-00/030",
    description: "Acciones correctivas y preventivas, ejecución, eficacia y cierre efectivo.",
    href: "/capa",
    status: "Operativo",
    tone: "ready",
    sections: ["Expedientes", "Acciones", "Seguimientos", "Eficacia", "Relaciones", "Documentos", "Indicadores"],
  },
  {
    name: "Controles de cambios",
    eyebrow: "GC-00/003",
    description: "Solicitud, dictamen, plan de ejecución, seguimientos, eficacia, documentos e indicadores.",
    href: "/changes",
    status: "Operativo",
    tone: "ready",
    sections: ["Expedientes", "Solicitud", "Dictamen", "Seguimientos", "Documentos", "Indicadores"],
  },
  {
    name: "Reclamaciones",
    eyebrow: "GC-00/027",
    description: "Módulo previsto para una fase posterior.",
    href: "#",
    status: "Pendiente",
    tone: "future",
    sections: ["No iniciado"],
  },
  {
    name: "Devoluciones",
    eyebrow: "GC-00/028",
    description: "Módulo previsto para una fase posterior.",
    href: "#",
    status: "Pendiente",
    tone: "future",
    sections: ["No iniciado"],
  },
];

export default function HomePage() {
  return (
    <section className="workspace home-workspace">
      <div className="home-hero">
        <div>
          <p className="eyebrow">COVEX · Sistema de Calidad</p>
          <h1>Gestión del Sistema de Calidad</h1>
          <p>
            Acceso único a los procesos operativos, expedientes, seguimientos,
            documentos e indicadores.
          </p>
        </div>
        <div className="pilot-callout">
          <strong>Versión piloto</strong>
          <span>Herramienta interna · sin firma electrónica ni audit trail GMP validado.</span>
        </div>
      </div>

      <div className="module-grid">
        {modules.map((module) => {
          const content = (
            <>
              <div className="module-card-topline">
                <span className="module-code">{module.eyebrow}</span>
                <span className={`module-state ${module.tone}`}>{module.status}</span>
              </div>
              <h2>{module.name}</h2>
              <p>{module.description}</p>
              <div className="module-section-list">
                {module.sections.map((section) => <span key={section}>{section}</span>)}
              </div>
              {module.href !== "#" ? <strong className="module-open">Abrir módulo →</strong> : null}
            </>
          );

          return module.href === "#" ? (
            <article key={module.name} className="module-card disabled-card">{content}</article>
          ) : (
            <Link key={module.name} href={module.href} className="module-card">{content}</Link>
          );
        })}
      </div>

      <section className="review-note">
        <div>
          <p className="eyebrow">Punto de control</p>
          <h2>Desviaciones + CAPA + Controles de cambios</h2>
        </div>
        <p>
          Los tres módulos operativos comparten la misma lógica visual, trazabilidad,
          versionado funcional, documentos e indicadores.
        </p>
      </section>
    </section>
  );
}
