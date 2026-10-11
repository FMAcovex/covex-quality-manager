import Link from "next/link";
import { DashboardPanel } from "@/modules/dashboard/dashboard-panel";
import { normalizeDashboardFilters } from "@/modules/dashboard/domain";
import { getDashboardData } from "@/modules/dashboard/queries";

export const dynamic = "force-dynamic";
const modules = [
  { name: "PNT y documentación", eyebrow: "Documentación controlada", description: "Maestro documental, revisiones, vigencia, verificación y próximas revisiones.", href: "/controlled-documents", status: "Operativo", tone: "ready", sections: ["Maestro", "Revisiones", "Verificación", "Vencimientos"] },
  { name: "Auditorías", eyebrow: "GC-00/033 · GC-00/034", description: "Expedientes de auditoría interna y externa, planificación, áreas y equipo auditor.", href: "/audits", status: "Operativo", tone: "ready", sections: ["Expedientes", "Planificación", "Participantes", "Historial"] },
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
    description: "Solicitud, Dictamen, plan aprobado, seguimientos, ejecución, eficacia y cierre.",
    href: "/changes",
    status: "Operativo",
    tone: "ready",
    sections: ["Solicitud", "Dictamen", "Seguimientos", "Relaciones", "Documentos", "Indicadores"],
  },
  {
    name: "Reclamaciones",
    eyebrow: "GC-00/027",
    description: "Investigación, resolución, CAPA, eficacia y cierre de reclamaciones de clientes y proveedores.",
    href: "/complaints",
    status: "Operativo",
    tone: "ready",
    sections: ["Registro", "Investigación", "Acciones", "Seguimientos", "Relaciones", "Indicadores"],
  },
  {
    name: "Devoluciones",
    eyebrow: "GC-00/028",
    description: "Recepción, evaluación técnica, decisión, destino final y trazabilidad de devoluciones.",
    href: "/returns",
    status: "Operativo",
    tone: "ready",
    sections: ["Datos generales", "Productos", "Comprobaciones", "Seguimientos", "Relaciones", "Indicadores"],
  },
];

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const filters = normalizeDashboardFilters(await searchParams);
  const dashboard = await getDashboardData(filters);
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

      <DashboardPanel data={dashboard} />
      <div className="dashboard-directory-heading"><h2>Acceso a módulos y expedientes</h2><p>Conservamos el acceso directo a las siete áreas del sistema.</p></div>
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
          <h2>Plataforma QMS común</h2>
        </div>
        <p>
          Desviaciones, CAPA, Controles de Cambios, Reclamaciones y Devoluciones comparten
          expediente, relaciones, seguimiento, documentos e indicadores, manteniendo
          las reglas y anexos específicos de cada PNT.
        </p>
      </section>
    </section>
  );
}
