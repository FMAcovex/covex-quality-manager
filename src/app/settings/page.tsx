import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { SettingsNav } from "@/components/settings-nav";
import { getAdministrationOverview,getAlertPreview,moduleLabel } from "@/modules/configuration/admin-queries";

export const dynamic="force-dynamic";

async function SettingsPageAuthenticatedContent(){
  const [data,preview]=await Promise.all([getAdministrationOverview(),getAlertPreview()]);
  const activeForms=data.forms.filter(x=>x.status==="ACTIVE"&&x.isActive);
  const activeTemplates=data.templates.filter(x=>x.isActive);
  const activeDepartments=data.departments.filter(x=>x.isActive);
  const activeRules=data.alertRules.filter(x=>x.isActive);
  const overdue=preview.items.filter(x=>x.state==="OVERDUE").length;
  return <section className="workspace">
    <div className="page-heading">
      <div><p className="eyebrow">Hito 9 · Administración funcional</p><h1>Administración y evolución</h1><p>Catálogos, versiones, plantillas, parámetros y preparación de vencimientos.</p></div>
      <span className="badge warning">Políticas operativas sujetas a aceptación QA/DT</span>
    </div>
    <SettingsNav active="/settings"/>
    <div className="analytics-note"><strong>Principio:</strong> la configuración nunca reescribe el histórico de expedientes. Las nuevas versiones se aplican por vigencia y los elementos usados se conservan aunque después se retiren.</div>
    <div className="summary-strip admin-summary">
      <div><strong>{activeDepartments.length}</strong><span>Departamentos activos</span></div>
      <div><strong>{activeForms.length}</strong><span>Formularios activos</span></div>
      <div><strong>{activeTemplates.length}</strong><span>Plantillas activas</span></div>
      <div><strong>{activeRules.length}</strong><span>Reglas de vencimiento</span></div>
      <div><strong>{overdue}</strong><span>Elementos vencidos ahora</span></div>
    </div>
    <div className="settings-grid admin-hub-grid">
      <PermissionGate permission="MANAGE_USERS" module="SYSTEM"><Link className="card settings-card admin-link-card" href="/settings/users"><h2>Usuarios y autorizaciones</h2><p>Acceso corporativo, roles y ámbitos de actuación.</p><strong>Abrir →</strong></Link></PermissionGate>
      <Link className="card settings-card admin-link-card" href="/settings/catalogs"><p className="eyebrow">Catálogos</p><h2>Departamentos y valores auxiliares</h2><p>Alta, vigencia y desactivación sin borrado físico.</p><strong>Abrir →</strong></Link>
      <Link className="card settings-card admin-link-card" href="/settings/versions"><p className="eyebrow">Versionado</p><h2>Formularios y plantillas</h2><p>Clonar versiones, preparar borradores y activar por fecha de vigencia.</p><strong>Abrir →</strong></Link>
      <Link className="card settings-card admin-link-card" href="/settings/parameters"><p className="eyebrow">Parámetros</p><h2>Comportamiento configurable</h2><p>Parámetros no estructurales sin duplicar lógica en los módulos.</p><strong>Abrir →</strong></Link>
      <Link className="card settings-card admin-link-card" href="/settings/alerts"><p className="eyebrow">Vencimientos</p><h2>Motor preparado para alertas</h2><p>Bandeja central de próximos/vencidos; el envío automático sigue desactivado.</p><strong>Abrir →</strong></Link>
    </div>
    <section className="card">
      <div className="section-title-row"><div><p className="eyebrow">Versiones activas</p><h2>Configuración aplicada a nuevos expedientes</h2></div></div>
      <div className="table-scroll"><table className="records-table compact-table"><thead><tr><th>Módulo</th><th>Versión</th><th>Vigente desde</th><th>Campos</th></tr></thead><tbody>
        {activeForms.map(f=><tr key={f.id}><td>{moduleLabel(f.module)}</td><td><strong>{f.versionCode}</strong></td><td>{f.effectiveFrom.toLocaleDateString("es-ES")}</td><td>{f._count.fieldConfigs}</td></tr>)}
      </tbody></table></div>
    </section>
  </section>;
}

export default async function SettingsPage(...args: Parameters<typeof SettingsPageAuthenticatedContent>) {
  return authorizedPage("src/app/settings/page.tsx", () => SettingsPageAuthenticatedContent(...args), args);
}
