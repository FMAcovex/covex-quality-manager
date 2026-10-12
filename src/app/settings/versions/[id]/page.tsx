import { canPresentRecord } from "@/lib/auth/presentation";
import { ActorField } from "@/components/permissions";
import { PermissionGate } from "@/components/permissions";
import { currentActor } from "@/lib/auth/presentation";

import { CsrfField } from "@/components/csrf";
import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SettingsNav } from "@/components/settings-nav";
import { updateFormFieldConfigAction } from "@/modules/configuration/admin-actions";
import { moduleLabel } from "@/modules/configuration/admin-queries";
import { prisma } from "@/lib/db";

export const dynamic="force-dynamic";

async function FormVersionDetailPageAuthenticatedContent({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const form=await prisma.formVersion.findUnique({where:{id},include:{fieldConfigs:{orderBy:[{sectionKey:"asc"},{sortOrder:"asc"}]}}});
 if(!form)notFound();
 const editable=form.status==="DRAFT" && canPresentRecord(form.module,"MANAGE_CONFIGURATION",{});
 return <section className="workspace">
  <div className="page-heading"><div><p className="eyebrow">Administración</p><h1>{moduleLabel(form.module)} · {form.versionCode}</h1><p>{editable?"Borrador editable antes de activación.":"Versión bloqueada por estar activa o retirada."}</p></div><Link className="button" href="/settings/versions">← Volver</Link></div>
  <SettingsNav active="/settings/versions"/>
  <div className="analytics-note"><strong>Alcance:</strong> desde aquí pueden cambiarse etiquetas y comportamiento de visualización/exportación del borrador. Añadir o eliminar campos GMP tipados requiere una actualización técnica con migración y pruebas.</div>
  <section className="card">
   <div className="section-title-row"><div><p className="eyebrow">Campos</p><h2>{form.fieldConfigs.length} definiciones</h2></div><span className={`badge ${editable?"warning":"neutral"}`}>{form.status}</span></div>
   <div className="table-scroll"><table className="records-table compact-table field-admin-table"><thead><tr><th>Clave</th><th>Definición</th><th>Tipo</th><th>Listado</th><th>Visible</th><th>Filtro</th><th>Exportación</th><th></th></tr></thead><tbody>
    {form.fieldConfigs.map(f=><tr key={f.id}><td><code>{f.fieldKey}</code><br/><small>{f.kind}</small></td><td colSpan={7}>{editable?<PermissionGate permission="MANAGE_CONFIGURATION" module={form.module}><form action={updateFormFieldConfigAction.bind(null,f.id)} className="field-config-form"><CsrfField /><input name="label" defaultValue={f.label}/><input name="sectionLabel" defaultValue={f.sectionLabel}/><input name="sortOrder" type="number" defaultValue={f.sortOrder}/><select name="listAvailable" defaultValue={String(f.listAvailable)}><option value="true">Sí listado</option><option value="false">No listado</option></select><select name="listVisibleByDefault" defaultValue={String(f.listVisibleByDefault)}><option value="true">Visible</option><option value="false">Oculta</option></select><select name="filterable" defaultValue={String(f.filterable)}><option value="true">Filtrable</option><option value="false">No filtrable</option></select><select name="simpleExport" defaultValue={String(f.simpleExport)}><option value="true">Exportar</option><option value="false">No exportar</option></select><ActorField type="hidden" name="actor" value={currentActor()}/><button className="button small">Guardar</button></form></PermissionGate>:<div className="field-config-readonly"><span>{f.label}</span><span>{f.sectionLabel}</span><span>{f.valueType}</span><span>{f.listAvailable?"Listado":"—"}</span><span>{f.listVisibleByDefault?"Visible":"Oculta"}</span><span>{f.filterable?"Filtrable":"—"}</span><span>{f.simpleExport?"Exporta":"—"}</span></div>}</td></tr>)}
   </tbody></table></div>
  </section>
 </section>;
}

export default async function FormVersionDetailPage(...args: Parameters<typeof FormVersionDetailPageAuthenticatedContent>) {
  return authorizedPage("src/app/settings/versions/[id]/page.tsx", () => FormVersionDetailPageAuthenticatedContent(...args), args);
}
