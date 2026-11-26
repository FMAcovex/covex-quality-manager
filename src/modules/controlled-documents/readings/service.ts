import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../../lib/db";
import { canAssignReadings, normalizeExternalName, type AddReadersInput } from "./domain";

/**
 * D-141: guardado de las lecturas de PNT. Cada operación bloquea el PNT (como la asignación de
 * responsables, D-118), deja constancia en el historial operativo y la captura B2 la registra en el
 * audit trail del PNT. La lectura confirmada es un control operativo, no una firma.
 */

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;
const selectable = { active: true, authorizedAt: { not: null } } as const;
const day = (value: string) => new Date(`${value}T00:00:00Z`);

async function lockOpenDocument(tx: Tx, documentId: string) {
  await tx.$queryRaw`SELECT id FROM "ControlledDocument" WHERE id = ${documentId} FOR UPDATE`;
  const master = await tx.controlledDocument.findUnique({ where: { id: documentId }, select: { administrativeStatus: true } });
  if (!master) throw new Error("El PNT ya no existe.");
  if (master.administrativeStatus === "ANNULLED") throw new Error("Un PNT anulado no admite lecturas.");
}

async function readableRevision(tx: Tx, documentId: string, revisionId: string) {
  const revision = await tx.controlledDocumentRevision.findFirst({ where: { id: revisionId, documentId }, select: { id: true, status: true, revisionCode: true } });
  if (!revision) throw new Error("La revisión no pertenece a este PNT.");
  if (!canAssignReadings(revision.status)) throw new Error(`La revisión ${revision.revisionCode} no está vigente ni aprobada pendiente de vigencia: no se piden lecturas de ella.`);
  return revision;
}

async function history(tx: Tx, documentId: string, revisionId: string, action: string, actor: string, oldValue: unknown, newValue: unknown) {
  await tx.controlledDocumentChange.create({ data: {
    documentId, revisionId, action, changedByText: actor, reason: "Lecturas del PNT (D-141)",
    oldValue: oldValue === null ? Prisma.JsonNull : JSON.parse(JSON.stringify(oldValue)), newValue: JSON.parse(JSON.stringify(newValue)),
  } });
}

const duplicatePending = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/**
 * Añade lectores a una revisión: usuarios elegidos, los usuarios activos de los departamentos elegidos y
 * personas externas por su nombre. Quien ya la tiene pendiente no se duplica.
 */
export async function addReaders(documentId: string, input: AddReadersInput, actor: string, db: Db = prisma) {
  try {
    return await db.$transaction(async tx => {
      await lockOpenDocument(tx, documentId);
      const revision = await readableRevision(tx, documentId, input.revisionId);
      if (input.departmentIds.length) {
        const found = await tx.department.count({ where: { id: { in: input.departmentIds }, isActive: true } });
        if (found !== input.departmentIds.length) throw new Error("Uno de los departamentos elegidos no existe o no está activo.");
      }
      const chosen = input.userIds.length ? await tx.authUser.findMany({ where: { id: { in: input.userIds }, ...selectable }, select: { id: true, displayName: true } }) : [];
      if (chosen.length !== input.userIds.length) throw new Error("Uno de los usuarios elegidos no está activo en la aplicación.");
      const members = input.departmentIds.length
        ? (await tx.authUserDepartment.findMany({ where: { departmentId: { in: input.departmentIds }, user: selectable }, select: { user: { select: { id: true, displayName: true } } } })).map(row => row.user)
        : [];
      const users = new Map([...chosen, ...members].map(user => [user.id, user.displayName]));
      const pending = await tx.controlledReadingAssignment.findMany({ where: { revisionId: revision.id, status: "PENDING" }, select: { readerUserId: true, readerName: true } });
      const pendingUsers = new Set(pending.flatMap(row => row.readerUserId ? [row.readerUserId] : []));
      const pendingExternal = new Set(pending.filter(row => !row.readerUserId).map(row => normalizeExternalName(row.readerName)));
      const rows = [
        ...[...users].filter(([id]) => !pendingUsers.has(id)).map(([id, name]) => ({ readerUserId: id, readerName: name })),
        ...input.externalNames.filter(name => !pendingExternal.has(normalizeExternalName(name))).map(name => ({ readerUserId: null, readerName: name })),
      ];
      const skipped = users.size + input.externalNames.length - rows.length;
      if (!rows.length) throw new Error(users.size || input.externalNames.length ? "Todas las personas elegidas ya tienen esta lectura pendiente." : "Los departamentos elegidos no tienen usuarios activos.");
      for (const row of rows) await tx.controlledReadingAssignment.create({ data: { documentId, revisionId: revision.id, ...row, dueDate: day(input.dueDate), assignedByText: actor } });
      await history(tx, documentId, revision.id, `Lectura pedida de la revisión ${revision.revisionCode}`, actor, null, { lectores: rows.map(row => row.readerName), plazo: input.dueDate });
      return { added: rows.length, skipped };
    });
  } catch (error) {
    if (duplicatePending(error)) throw new Error("Alguna de las personas ya tiene esta lectura pendiente. Recarga y vuelve a intentarlo.");
    throw error;
  }
}

/** Lectores anteriores del PNT (de sus otras revisiones, salvo retirados) a los que se pide leer esta. */
export async function requestPreviousReaders(documentId: string, input: { revisionId: string; dueDate: string }, actor: string, db: Db = prisma) {
  const previous = await db.controlledReadingAssignment.findMany({
    where: { documentId, revisionId: { not: input.revisionId }, status: { not: "WITHDRAWN" } },
    select: { readerUserId: true, readerName: true, readerUser: { select: { active: true, authorizedAt: true } } },
  });
  const userIds = [...new Set(previous.filter(row => row.readerUserId && row.readerUser?.active && row.readerUser.authorizedAt).map(row => row.readerUserId!))];
  const seen = new Set<string>();
  const externalNames = previous.filter(row => !row.readerUserId).map(row => row.readerName).filter(name => !seen.has(normalizeExternalName(name)) && Boolean(seen.add(normalizeExternalName(name))));
  if (!userIds.length && !externalNames.length) throw new Error("Este PNT no tiene lectores anteriores activos.");
  return addReaders(documentId, { revisionId: input.revisionId, userIds, departmentIds: [], externalNames, dueDate: input.dueDate }, actor, db);
}

async function pendingReading(tx: Tx, documentId: string, readingId: string) {
  const reading = await tx.controlledReadingAssignment.findFirst({ where: { id: readingId, documentId }, include: { revision: { select: { status: true, revisionCode: true } } } });
  if (!reading) throw new Error("La lectura no pertenece a este PNT.");
  if (reading.status !== "PENDING") throw new Error("Esta lectura ya no está pendiente. Recarga la ficha.");
  if (!canAssignReadings(reading.revision.status)) throw new Error(`La revisión ${reading.revision.revisionCode} ya no está en lectura.`);
  return reading;
}

/**
 * Marca una lectura como leída. Cada persona marca la suya (`onBehalf` false); Garantía de Calidad,
 * con su permiso, la de cualquiera, incluidas las personas externas, y queda constancia.
 */
export async function confirmReading(documentId: string, input: { readingId: string; readOn: string }, who: { actor: string; userId: string | null | undefined; onBehalf: boolean }, db: Db = prisma) {
  return db.$transaction(async tx => {
    await lockOpenDocument(tx, documentId);
    const reading = await pendingReading(tx, documentId, input.readingId);
    const own = Boolean(who.userId) && reading.readerUserId === who.userId;
    if (!who.onBehalf && !own) throw new Error("Solo puedes marcar tus propias lecturas.");
    await tx.controlledReadingAssignment.update({ where: { id: reading.id }, data: {
      status: "READ", readOn: day(input.readOn), confirmedAt: new Date(), confirmedByText: who.actor, confirmedOnBehalf: !own,
    } });
    await history(tx, documentId, reading.revisionId, `Lectura confirmada de la revisión ${reading.revision.revisionCode}`, who.actor,
      { estado: "Pendiente" }, { lector: reading.readerName, estado: "Leído", fecha: input.readOn, ...(own ? {} : { confirmadaPor: who.actor }) });
  });
}

/** Relectura: nueva lectura pendiente de la misma revisión para quien ya la leyó. */
export async function requestReread(documentId: string, input: { readingId: string; dueDate: string }, actor: string, db: Db = prisma) {
  try {
    return await db.$transaction(async tx => {
      await lockOpenDocument(tx, documentId);
      const reading = await tx.controlledReadingAssignment.findFirst({ where: { id: input.readingId, documentId }, include: { revision: { select: { status: true, revisionCode: true } } } });
      if (!reading) throw new Error("La lectura no pertenece a este PNT.");
      if (reading.status !== "READ") throw new Error("Solo se envía a relectura a quien ya ha leído la revisión.");
      if (!canAssignReadings(reading.revision.status)) throw new Error(`La revisión ${reading.revision.revisionCode} ya no está en lectura: pide la lectura de la revisión vigente.`);
      if (reading.readerUserId && !await tx.authUser.count({ where: { id: reading.readerUserId, ...selectable } })) throw new Error("Esta persona ya no es un usuario activo de la aplicación: retírala o pide la lectura a quien la sustituya.");
      const samePerson = reading.readerUserId ? { readerUserId: reading.readerUserId } : { readerUserId: null, readerName: { equals: reading.readerName, mode: "insensitive" as const } };
      if (await tx.controlledReadingAssignment.count({ where: { revisionId: reading.revisionId, status: "PENDING", ...samePerson } })) throw new Error("Esta persona ya tiene la lectura pendiente.");
      await tx.controlledReadingAssignment.create({ data: { documentId, revisionId: reading.revisionId, readerUserId: reading.readerUserId, readerName: reading.readerName, dueDate: day(input.dueDate), assignedByText: actor } });
      await history(tx, documentId, reading.revisionId, `Relectura de la revisión ${reading.revision.revisionCode}`, actor, null, { lector: reading.readerName, plazo: input.dueDate });
    });
  } catch (error) {
    if (duplicatePending(error)) throw new Error("Esta persona ya tiene la lectura pendiente.");
    throw error;
  }
}

/** Retira a alguien que ya no debe leer la revisión. No se borra: queda como retirada, con su motivo. */
export async function withdrawReading(documentId: string, input: { readingId: string; reason: string }, actor: string, db: Db = prisma) {
  return db.$transaction(async tx => {
    await lockOpenDocument(tx, documentId);
    const reading = await pendingReading(tx, documentId, input.readingId);
    await tx.controlledReadingAssignment.update({ where: { id: reading.id }, data: { status: "WITHDRAWN", withdrawnAt: new Date(), withdrawnByText: actor, withdrawalReason: input.reason } });
    await history(tx, documentId, reading.revisionId, `Lectura retirada de la revisión ${reading.revision.revisionCode}`, actor,
      { estado: "Pendiente" }, { lector: reading.readerName, estado: "Retirada", motivo: input.reason });
  });
}
