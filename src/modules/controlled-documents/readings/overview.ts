import type { Principal } from "@/lib/auth/context";
import { canPresent } from "@/lib/auth/presentation";
import { readerKey } from "./domain";

/**
 * D-141, entrega 2: panel «Lecturas de PNT». Reglas puras de los filtros y de la agrupación de las lecturas
 * pendientes de todos los PNT; la consulta está en queries.ts.
 */
export type OverviewFilters = { view: "pending" | "assign"; group: "person" | "pnt"; person: string; q: string; department: string; overdue: boolean };

const text = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Persona del filtro: «user:<uuid>» o «external:<nombre>»; otra cosa se descarta. */
function personFilter(value: string) {
  if (value.startsWith("user:")) return uuid.test(value.slice(5)) ? value : "";
  return value.startsWith("external:") && value.length > 9 ? value.slice(0, 300) : "";
}
export function parseOverviewFilters(params: Record<string, string | string[] | undefined>): OverviewFilters {
  return {
    view: text(params.view) === "assign" ? "assign" : "pending",
    group: text(params.group) === "pnt" ? "pnt" : "person",
    person: personFilter(text(params.person)),
    q: text(params.q).slice(0, 200),
    department: text(params.department).slice(0, 100),
    overdue: text(params.overdue) === "1",
  };
}

export type PendingRow = { id: string; documentId: string; baseCode: string; title: string; revisionCode: string; readerUserId: string | null; readerName: string; dueDate: string };
export type PendingGroup<T extends PendingRow> = { key: string; label: string; external: boolean; rows: T[]; overdue: number };

const es = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" });
/** Agrupa por persona (una persona externa es su nombre normalizado) o por PNT, con las vencidas de cada grupo. */
export function groupPendingReadings<T extends PendingRow>(rows: T[], by: "person" | "pnt", today: string): PendingGroup<T>[] {
  const keyOf = (row: T) => by === "person" ? readerKey(row) : row.documentId;
  const within = by === "person"
    ? (a: T, b: T) => a.dueDate.localeCompare(b.dueDate) || es(a.baseCode, b.baseCode)
    : (a: T, b: T) => es(a.readerName, b.readerName) || a.dueDate.localeCompare(b.dueDate);
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(keyOf(row), [...groups.get(keyOf(row)) ?? [], row]);
  return [...groups].map(([key, list]) => {
    const sorted = [...list].sort(within);
    return { key, label: by === "person" ? sorted[0].readerName : sorted[0].baseCode, external: by === "person" && !sorted[0].readerUserId, rows: sorted, overdue: sorted.filter(row => row.dueDate < today).length };
  }).sort((a, b) => es(a.label, b.label));
}

/**
 * Asignar lecturas exige editar el PNT (D-141). Quien edita solo los PNT de su departamento o los asignados
 * también usa la asignación masiva, con esos PNT; el servidor vuelve a comprobar cada uno.
 */
export function canAssignSomeReading(user: Principal) {
  return user.active && user.authorized && user.grants.some(grant => grant.module === "PNT" && grant.permission === "EDIT");
}
export function assignableCandidates<T extends { id: string; departmentId: string | null }>(user: Principal, candidates: T[]): T[] {
  return candidates.filter(candidate => canPresent(user, "PNT", "EDIT", { id: candidate.id, departmentIds: candidate.departmentId ? [candidate.departmentId] : [] }));
}
