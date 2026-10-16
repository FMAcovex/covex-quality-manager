import { PermissionGate } from "@/components/permissions";

import { CsrfField } from "@/components/csrf";
import { prisma } from "@/lib/db";
import { requireUserAdministration } from "@/lib/auth/administration";
import { AccessError, type AccessModule, type AccessPermission } from "@/lib/auth/context";
import { allScopeOnlyPermissions, assignablePermissions, permissionLabels, roleEditorModules, roleGrantError } from "@/lib/auth/role-policy";
import { redirect } from "next/navigation";
import { saveRolePolicy, saveUserAuthorization } from "./actions";
export const dynamic = "force-dynamic";
type RoleGrant = { module: AccessModule; permission: AccessPermission; scope: "ALL" | "ASSIGNED" };
function RoleGrantsEditor({ roleName, grants }: { roleName: string; grants: RoleGrant[] }) {
  const current = new Map(grants.map(g => [`${g.module}:${g.permission}`, g.scope]));
  const unsupported = grants.filter(g => roleGrantError(g));
  return <fieldset className="role-grants"><legend>Permisos por módulo y ámbito</legend>
    {unsupported.length > 0 && <div className="form-errors" role="note"><p>Este rol tiene {unsupported.length} permisos que su módulo no admite; se retirarán al guardar:</p><ul>{roleEditorModules.filter(m => unsupported.some(g => g.module === m.key)).map(m => <li key={m.key}><strong>{m.label}:</strong> {unsupported.filter(g => g.module === m.key).map(g => permissionLabels[g.permission]).join(", ")}</li>)}</ul></div>}
    <div className="table-scroll"><table className="records-table role-grants-table"><thead><tr><th scope="col">Módulo</th><th scope="col">Permisos y ámbito (Todos / Asignados)</th></tr></thead><tbody>
      {roleEditorModules.map(module => <tr key={module.key}><th scope="row">{module.label}</th><td><div className="role-grant-list">
        {assignablePermissions(module.key).map(permission => { const key = `${module.key}:${permission}`; const label = permissionLabels[permission]; return <span key={key} className="role-grant">
          <label><input type="checkbox" name="grant" value={key} defaultChecked={current.has(key)} /> {label}</label>
          <select name={`scope:${key}`} defaultValue={current.get(key) ?? "ALL"} aria-label={`Ámbito de ${label} en ${module.label} (${roleName})`}><option value="ALL">Todos</option>{!allScopeOnlyPermissions.includes(permission) && <option value="ASSIGNED">Asignados</option>}</select>
        </span>; })}
      </div></td></tr>)}
    </tbody></table></div>
  </fieldset>;
}
export default async function UsersPage() {
  let actor;
  try { actor = await requireUserAdministration(); } catch (error) { if (error instanceof AccessError) redirect("/login?error=access"); throw error; }
  const [users, roles, departments, changes] = await Promise.all([
    prisma.authUser.findMany({ include: { roles: true, departments: true, assignments: true }, orderBy: { displayName: "asc" } }),
    prisma.authRole.findMany({ include: { permissions: true, users: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.authAuthorizationChange.findMany({ take: 50, orderBy: { createdAt: "desc" }, include: { actorUser: { select: { displayName: true } } } }),
  ]);
  function fields(user?: typeof users[number]) {
    return <><input type="hidden" name="id" value={user?.id ?? ""}/><label>Identificador Entra (oid)<input name="objectId" required defaultValue={user?.objectId} readOnly={Boolean(user)}/></label><label>Nombre visible<input name="displayName" required defaultValue={user?.displayName}/></label><label>Correo corporativo<input name="email" type="email" required defaultValue={user?.email}/></label><label><input name="active" type="checkbox" defaultChecked={user?.active}/> Autorizar acceso activo</label><fieldset><legend>Roles</legend>{roles.map(r => <label key={r.id}><input type="checkbox" name="roleId" value={r.id} defaultChecked={user?.roles.some(ur => ur.roleId === r.id)}/>{r.name}</label>)}</fieldset><fieldset><legend>Departamentos para actuaciones limitadas</legend>{departments.map(d => <label key={d.id}><input type="checkbox" name="departmentId" value={d.id} defaultChecked={user?.departments.some(ud => ud.departmentId === d.id)}/>{d.name}</label>)}</fieldset><label>Expedientes asignados (módulo e identificador interno)<textarea name="assignments" defaultValue={JSON.stringify(user?.assignments.map(a => ({ module: a.module, recordId: a.recordId })) ?? [])}/></label><label>Motivo administrativo<textarea name="reason" required minLength={10}/></label><button type="submit">Guardar autorización y revocar sesiones anteriores</button></>;
  }
  return <section className="workspace"><h1>Usuarios y autorizaciones</h1><p>La consulta ordinaria es global. Los permisos operativos propuestos quedan inactivos hasta aceptación administrativa documentada de QA/DT; no constituye firma ni aprobación GMP.</p><details className="card"><summary>Incorporar usuario autorizado</summary><PermissionGate permission="MANAGE_USERS"><form action={saveUserAuthorization}><CsrfField />{fields()}</form></PermissionGate></details>{users.map(u => <details key={u.id} className="card"><summary>{u.displayName} · {u.active ? "Activo" : "Inactivo"}</summary>{u.id === actor.id ? <p>Las autorizaciones propias se gestionan por otro administrador.</p> : <PermissionGate permission="MANAGE_USERS"><form action={saveUserAuthorization}><CsrfField />{fields(u)}</form></PermissionGate>}</details>)}<h2>Políticas de roles</h2>{roles.map(r => <details key={r.id} className="card"><summary>{r.name} · {r.qaAcceptedAt ? "Aceptación documentada" : "Pendiente QA/DT"}</summary>{r.key === "TECHNICAL_ADMIN" || r.users.some(u => u.userId === actor.id) ? <p>Rol reservado o propio: edición no permitida.</p> : <PermissionGate permission="MANAGE_USERS"><form action={saveRolePolicy}><CsrfField /><input type="hidden" name="roleId" value={r.id}/><RoleGrantsEditor roleName={r.name} grants={r.permissions} /><label>Motivo<textarea name="reason" minLength={10} required/></label><button>Proponer política (requiere nueva aceptación QA/DT)</button></form></PermissionGate>}</details>)}<h2>Historial administrativo reciente</h2><ul>{changes.map(c => <li key={c.id}>{c.createdAt.toISOString()} · {c.actorUser?.displayName ?? c.source} · {c.action} · {c.reason}</li>)}</ul></section>;
}
