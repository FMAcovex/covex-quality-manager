import { storedAdditionalLots } from "@/lib/qms/additional-lots";

// Ayuda para valorar la recurrencia (D-095): desviaciones de los 12 meses anteriores que
// comparten lote, producto/material o área y procedencia. Solo informa; la valoración
// «¿Causa raíz recurrente?» la sigue haciendo Calidad.
export const RECURRENCE_WINDOW_MONTHS = 12;

export type RecurrenceSource = {
  id: string;
  issueDate: Date | null;
  departmentId: string | null;
  provenance: string | null;
  finishedProductSystem: string | null;
  productLot: string | null;
  rawOrPackagingMaterial: string | null;
  materialLot: string | null;
  supplierLot: string | null;
  additionalLots: unknown;
};

export type RecurrenceReason = "LOT" | "PRODUCT" | "AREA_ORIGIN";
export const recurrenceReasonLabels: Record<RecurrenceReason, string> = {
  LOT: "mismo lote",
  PRODUCT: "mismo producto o material",
  AREA_ORIGIN: "misma área y procedencia",
};

const norm = (value: string | null | undefined) => value?.trim().toLocaleUpperCase("es").replace(/\s+/g, " ") ?? "";
const set = (values: Array<string | null | undefined>) => new Set(values.map(norm).filter(Boolean));
const overlaps = (a: Set<string>, b: Set<string>) => [...a].some((value) => b.has(value));

function keys(record: RecurrenceSource) {
  const extra = storedAdditionalLots(record.additionalLots);
  return {
    lots: set([record.productLot, record.materialLot, record.supplierLot, ...extra.map((lot) => lot.lot)]),
    products: set([record.finishedProductSystem, record.rawOrPackagingMaterial, ...extra.map((lot) => lot.name)]),
  };
}

/** Motivos por los que `other` se parece a `record`; vacío si no se parece. */
export function recurrenceReasons(record: RecurrenceSource, other: RecurrenceSource): RecurrenceReason[] {
  if (record.id === other.id) return [];
  const a = keys(record), b = keys(other);
  const reasons: RecurrenceReason[] = [];
  if (overlaps(a.lots, b.lots)) reasons.push("LOT");
  if (overlaps(a.products, b.products)) reasons.push("PRODUCT");
  if (record.departmentId && record.departmentId === other.departmentId && norm(record.provenance) && norm(record.provenance) === norm(other.provenance)) reasons.push("AREA_ORIGIN");
  return reasons;
}

/** Inicio de la ventana: 12 meses antes de la fecha de apertura (o de hoy si no la tiene). */
export function recurrenceWindowStart(issueDate: Date | null, today = new Date()) {
  const base = issueDate ?? today;
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - RECURRENCE_WINDOW_MONTHS, base.getUTCDate()));
}

/** Coincidencias ordenadas: más motivos primero y, a igualdad, las más recientes. */
export function rankSimilar<T extends RecurrenceSource>(record: RecurrenceSource, candidates: T[], limit = 10) {
  return candidates
    .map((candidate) => ({ candidate, reasons: recurrenceReasons(record, candidate) }))
    .filter((item) => item.reasons.length)
    .sort((a, b) => b.reasons.length - a.reasons.length || (b.candidate.issueDate?.getTime() ?? 0) - (a.candidate.issueDate?.getTime() ?? 0))
    .slice(0, limit);
}
