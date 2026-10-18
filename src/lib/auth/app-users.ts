import "server-only";
import { prisma } from "@/lib/db";
import type { AppUserOption } from "@/lib/qms/responsible-user";

const selectable = { active: true, authorizedAt: { not: null } } as const;

/**
 * Usuarios que se pueden elegir como responsables (D-101): los activos y autorizados, más los ya
 * asignados en el expediente aunque hoy estén inactivos, para que se sigan viendo.
 */
export async function appUserOptions(assigned: Array<string | null | undefined> = []): Promise<AppUserOption[]> {
  const ids = [...new Set(assigned.filter((id): id is string => Boolean(id)))];
  const users = await prisma.authUser.findMany({
    where: { OR: [selectable, ...(ids.length ? [{ id: { in: ids } }] : [])] },
    select: { id: true, displayName: true, active: true, authorizedAt: true },
    orderBy: { displayName: "asc" },
  });
  return users.map((user) => ({ id: user.id, name: user.displayName, active: user.active && Boolean(user.authorizedAt) }));
}

export const inactiveResponsibleUserMessage = "El usuario responsable elegido no está activo en la aplicación.";

/**
 * Cada usuario nuevo debe estar activo; uno ya asignado antes se puede conservar aunque se haya
 * desactivado después. Devuelve el mensaje de error o null.
 */
export async function responsibleUsersProblem(ids: Array<string | null | undefined>, alreadyAssigned: Array<string | null | undefined> = []) {
  const kept = new Set(alreadyAssigned.filter(Boolean));
  const required = [...new Set(ids.filter((id): id is string => Boolean(id) && !kept.has(id)))];
  if (!required.length) return null;
  const found = await prisma.authUser.count({ where: { id: { in: required }, ...selectable } });
  return found === required.length ? null : inactiveResponsibleUserMessage;
}
