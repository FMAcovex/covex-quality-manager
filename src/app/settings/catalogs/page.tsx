import { ActorField } from "@/components/permissions";
import { PermissionGate } from "@/components/permissions";
import { currentActor } from "@/lib/auth/presentation";

import { CsrfField } from "@/components/csrf";
import { authorizedPage } from "@/lib/auth/page-guard";
import { QmsRecordType } from "@prisma/client";
import { SettingsNav } from "@/components/settings-nav";
import { createCatalogAction,createCatalogItemAction,createDepartmentAction,updateCatalogAction,updateCatalogItemAction,updateDepartmentAction } from "@/modules/configuration/admin-actions";
import { getAdministrationOverview,moduleLabel } from "@/modules/configuration/admin-queries";

export const dynamic="force-dynamic";
const iso=(v:Date|null)=>v?v.toISOString().slice(0,10):"";

async function CatalogsPageAuthenticatedContent(){
 const data=await getAdministrationOverview();
 return <section className="workspace">
  <div className="page-heading"><div><p className="eyebrow">Administración</p><h1>Catálogos</h1><p>Departamentos y valores auxiliares con vigencia e histórico.</p></div></div>
  <SettingsNav active="/settings/catalogs"/>
  <div className="analytics-note"><strong>Regla de histórico:</strong> un código utilizado no se elimina ni se reutiliza con otro significado. Si deja de aplicar se marca como inactivo y, cuando corresponda, se informa su fecha de fin de vigencia.</div>

  <section className="card"><div className="section-title-row"><div><p className="eyebrow">Organización</p><h2>Departamentos</h2></div><span className="badge neutral">{data.departments.filter(x=>x.isActive).length} activos</span></div>
   <div className="table-scroll"><table className="records-table compact-table admin-edit-table"><thead><tr><th>Código</th><th>Nombre</th><th>Desde</th><th>Hasta</th><th>Estado</th><th>Guardar</th></tr></thead><tbody>
    {data.departments.map(d=><tr key={d.id}><td><strong>{d.code}</strong></td><td colSpan={5}><PermissionGate permission="MANAGE_CONFIGURATION" fallback={<span>{d.name} · {iso(d.validFrom)} · {iso(d.validTo)} · {d.isActive?"Activo":"Inactivo"}</span>}><form action={updateDepartmentAction.bind(null,d.id)} className="admin-row-form"><CsrfField /><input name="name" defaultValue={d.name}/><input name="validFrom" type="date" defaultValue={iso(d.validFrom)}/><input name="validTo" type="date" defaultValue={iso(d.validTo)}/><select name="isActive" defaultValue={String(d.isActive)}><option value="true">Activo</option><option value="false">Inactivo</option></select><ActorField type="hidden" name="actor" value={currentActor()}/><button className="button small">Guardar</button></form></PermissionGate></td></tr>)}
   </tbody></table></div>
   <PermissionGate permission="MANAGE_CONFIGURATION"><details className="admin-create-panel"><summary className="button">+ Nuevo departamento</summary><PermissionGate permission="MANAGE_CONFIGURATION"><form action={createDepartmentAction} className="inline-form admin-inline-form"><CsrfField /><label className="field"><span>Código</span><input name="code" placeholder="MC-10" required/></label><label className="field"><span>Nombre</span><input name="name" required/></label><label className="field"><span>Vigente desde</span><input name="validFrom" type="date"/></label><label className="field full"><span>Motivo / referencia</span><input name="reason"/></label><ActorField type="hidden" name="actor" value={currentActor()}/><div className="full"><button className="button primary">Crear departamento</button></div></form></PermissionGate></details></PermissionGate>
  </section>

  <section className="card"><div className="section-title-row"><div><p className="eyebrow">Valores auxiliares</p><h2>Catálogos administrables</h2></div><span className="badge neutral">{data.catalogs.length} catálogos</span></div>
   <p className="muted-note">Estos catálogos están destinados a valores auxiliares. Los estados GMP y clasificaciones estructurales siguen tipados en la aplicación y no se pueden redefinir aquí.</p>
   <div className="admin-catalog-grid">
    {data.catalogs.map(cat=><article className="admin-catalog-card" key={cat.id}>
      <PermissionGate permission="MANAGE_CONFIGURATION" module={cat.module ?? "SYSTEM"} fallback={<div><strong>{cat.label}</strong><small>{cat.key} · {cat.module?moduleLabel(cat.module):"Global"}</small><p>{cat.description}</p></div>}><form action={updateCatalogAction.bind(null,cat.id)} className="admin-catalog-heading"><CsrfField />
       <div><strong>{cat.label}</strong><small>{cat.key} · {cat.module?moduleLabel(cat.module):"Global"}</small></div>
       <input name="label" defaultValue={cat.label} aria-label="Nombre catálogo"/>
       <input name="description" defaultValue={cat.description??""} placeholder="Descripción"/>
       <select name="isActive" defaultValue={String(cat.isActive)}><option value="true">Activo</option><option value="false">Inactivo</option></select>
       <ActorField type="hidden" name="actor" value={currentActor()}/>
       <button className="button small">Guardar catálogo</button>
      </form></PermissionGate>
      <div className="table-scroll"><table className="records-table compact-table"><thead><tr><th>Clave</th><th>Etiqueta / orden / vigencia</th></tr></thead><tbody>
       {cat.items.map(item=><tr key={item.id}><td><strong>{item.key}</strong></td><td><PermissionGate permission="MANAGE_CONFIGURATION" module={cat.module ?? "SYSTEM"} fallback={<span>{item.label} · orden {item.sortOrder} · {item.isActive?"Activo":"Inactivo"}</span>}><form action={updateCatalogItemAction.bind(null,item.id)} className="catalog-item-form"><CsrfField /><input name="label" defaultValue={item.label}/><input name="sortOrder" type="number" defaultValue={item.sortOrder}/><input name="validFrom" type="date" defaultValue={iso(item.validFrom)}/><input name="validTo" type="date" defaultValue={iso(item.validTo)}/><select name="isActive" defaultValue={String(item.isActive)}><option value="true">Activo</option><option value="false">Inactivo</option></select><input name="notes" defaultValue={item.notes??""} placeholder="Notas"/><ActorField type="hidden" name="actor" value={currentActor()}/><button className="button small">Guardar</button></form></PermissionGate></td></tr>)}
      </tbody></table></div>
      <PermissionGate permission="MANAGE_CONFIGURATION" module={cat.module ?? "SYSTEM"}><details className="admin-create-panel compact"><summary>+ Añadir valor</summary><PermissionGate permission="MANAGE_CONFIGURATION" module={cat.module ?? "SYSTEM"}><form action={createCatalogItemAction.bind(null,cat.id)} className="catalog-item-create"><CsrfField /><input name="key" placeholder="CLAVE" required/><input name="label" placeholder="Etiqueta" required/><input name="sortOrder" type="number" defaultValue="100"/><input name="validFrom" type="date"/><input name="notes" placeholder="Notas"/><ActorField type="hidden" name="actor" value={currentActor()}/><button className="button small primary">Añadir</button></form></PermissionGate></details></PermissionGate>
    </article>)}
   </div>
   <PermissionGate permission="MANAGE_CONFIGURATION" anyModule><details className="admin-create-panel"><summary className="button">+ Nuevo catálogo auxiliar</summary><PermissionGate permission="MANAGE_CONFIGURATION" anyModule><form action={createCatalogAction} className="inline-form admin-inline-form"><CsrfField /><label className="field"><span>Clave técnica</span><input name="key" placeholder="SUPPLIER_CATEGORY" required/></label><label className="field"><span>Nombre</span><input name="label" required/></label><label className="field"><span>Módulo</span><select name="module" defaultValue=""><PermissionGate permission="MANAGE_CONFIGURATION" module="SYSTEM"><option value="">Global</option></PermissionGate>{Object.values(QmsRecordType).map(m=><PermissionGate permission="MANAGE_CONFIGURATION" module={m} key={m}><option key={m} value={m}>{moduleLabel(m)}</option></PermissionGate>)}</select></label><label className="field full"><span>Descripción</span><input name="description"/></label><ActorField type="hidden" name="actor" value={currentActor()}/><div className="full"><button className="button primary">Crear catálogo</button></div></form></PermissionGate></details></PermissionGate>
  </section>
 </section>;
}

export default async function CatalogsPage(...args: Parameters<typeof CatalogsPageAuthenticatedContent>) {
  return authorizedPage("src/app/settings/catalogs/page.tsx", () => CatalogsPageAuthenticatedContent(...args), args);
}
