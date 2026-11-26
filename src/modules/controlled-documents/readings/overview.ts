import { readerKey } from "./domain";

/**
 * D-141, entrega 2: panel «Lecturas de PNT». Reglas puras de los filtros y de la agrupación de las lecturas
 * pendientes de todos los PNT; la consulta está en queries.ts.
 */
export type OverviewFilters = { view: "pending" | "assign"; group: "person" | "pnt"; person: string; q: string; department: string; overdue: boolean };

const text = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
export function parseOverviewFilters(params: Record<string, string | string[] | undefined>): OverviewFilters {
  return {
    view: text(params.view) === "assign" ? "assign" : "pending",
    group: text(params.group) === "pnt" ? "pnt" : "person",
    person: text(params.person).slice(0, 300),
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
