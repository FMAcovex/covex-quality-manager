import { PermissionGate } from "@/components/permissions";

import { CsrfField } from "@/components/csrf";
import { prisma } from "@/lib/db";
import { requireUserAdministration } from "@/lib/auth/administration";
import { AccessError } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { saveRolePolicy, saveUserAuthorization } from "./actions";
export const dynamic = "force-dynamic";
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
  return <section className="workspace"><h1>Usuarios y autorizaciones</h1><p>La consulta ordinaria es global. Los permisos operativos propuestos quedan inactivos hasta aceptación administrativa documentada de QA/DT; no constituye firma ni aprobación GMP.</p><details className="card"><summary>Incorporar usuario autorizado</summary><PermissionGate permission="MANAGE_USERS"><form action={saveUserAuthorization}><CsrfField />{fields()}</form></PermissionGate></details>{users.map(u => <details key={u.id} className="card"><summary>{u.displayName} · {u.active ? "Activo" : "Inactivo"}</summary>{u.id === actor.id ? <p>Las autorizaciones propias se gestionan por otro administrador.</p> : <PermissionGate permission="MANAGE_USERS"><form action={saveUserAuthorization}><CsrfField />{fields(u)}</form></PermissionGate>}</details>)}<h2>Políticas de roles</h2>{roles.map(r => <details key={r.id} className="card"><summary>{r.name} · {r.qaAcceptedAt ? "Aceptación documentada" : "Pendiente QA/DT"}</summary>{r.key === "TECHNICAL_ADMIN" || r.users.some(u => u.userId === actor.id) ? <p>Rol reservado o propio: edición no permitida.</p> : <PermissionGate permission="MANAGE_USERS"><form action={saveRolePolicy}><CsrfField /><input type="hidden" name="roleId" value={r.id}/><label>Permisos por módulo y ámbito<textarea name="grants" defaultValue={JSON.stringify(r.permissions.map(p => ({ module: p.module, permission: p.permission, scope: p.scope })), null, 2)}/></label><label>Motivo<textarea name="reason" minLength={10} required/></label><button>Proponer política (requiere nueva aceptación QA/DT)</button></form></PermissionGate>}</details>)}<h2>Historial administrativo reciente</h2><ul>{changes.map(c => <li key={c.id}>{c.createdAt.toISOString()} · {c.actorUser?.displayName ?? c.source} · {c.action} · {c.reason}</li>)}</ul></section>;
}
