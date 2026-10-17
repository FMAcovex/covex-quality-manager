import {
  buildAging,
  countLabels,
  daysFromTo,
  inYearToDate,
  isDue,
  medianOf,
  yearToDateWindow,
  type YearToDateComparison,
} from "@/lib/qms/analytics/trends";
import { productTypeLabel, returnTypeLabel } from "@/modules/returns/domain";

// Tendencias y pendientes de Devoluciones (2026-10-17). Descriptivos: sin objetivos ni
// plazos del PNT.

export type ReturnTrendRow = {
  openingYear: number | null;
  communicationDate: Date | null;
  closedAt: Date | null;
  decisionDate: Date | null;
  decision: "PENDING" | "ACCEPTED" | "REJECTED";
  productTypes: string[];
};

export const RETURN_PARETO = { type: "Tipo", productType: "Tipo de producto", department: "Área" } as const;
export type ReturnParetoDimension = keyof typeof RETURN_PARETO;

/** Tipos de producto de las devoluciones del año (una devolución puede incluir varios productos). */
export function returnProductMentions(rows: ReturnTrendRow[], year: number) {
  return countLabels(
    rows
      .filter((row) => row.openingYear === year)
      .flatMap((row) => (row.productTypes.length ? row.productTypes.map(productTypeLabel) : ["Sin producto registrado"])),
  );
}

/** Días naturales desde la comunicación hasta la decisión de Calidad. */
export function decisionDays(row: Pick<ReturnTrendRow, "communicationDate" | "decisionDate" | "decision">) {
  return row.decision === "PENDING" ? null : daysFromTo(row.communicationDate, row.decisionDate);
}

const medianDecision = (rows: ReturnTrendRow[]) =>
  medianOf(rows.map(decisionDays).filter((days): days is number => days !== null));

/** Mediana comunicación→decisión de las decisiones tomadas en el año. */
export function medianDecisionDays(rows: ReturnTrendRow[], year: number) {
  return medianDecision(rows.filter((row) => row.decisionDate?.getUTCFullYear() === year));
}

export function buildReturnYearToDate(
  rows: ReturnTrendRow[],
  selectedYear: number,
  covered: Set<number>,
  today: Date,
): YearToDateComparison {
  const window = yearToDateWindow(selectedYear, today);
  const period = (year: number) => {
    const inPeriod = (date: Date | null) => inYearToDate(window, year, date);
    const opened = rows.filter((row) => inPeriod(row.communicationDate));
    const decided = rows.filter((row) => row.decision !== "PENDING" && inPeriod(row.decisionDate));
    return {
      opened: opened.length,
      accepted: decided.filter((row) => row.decision === "ACCEPTED").length,
      rejected: decided.filter((row) => row.decision === "REJECTED").length,
      closed: rows.filter((row) => inPeriod(row.closedAt)).length,
      decision: medianDecision(decided),
    };
  };
  const current = period(selectedYear);
  const previous = period(selectedYear - 1);
  return {
    ...window,
    currentYear: selectedYear,
    previousYear: selectedYear - 1,
    currentAvailable: covered.has(selectedYear),
    previousAvailable: covered.has(selectedYear - 1),
    rows: [
      { label: "Devoluciones", current: current.opened, previous: previous.opened, format: "count" },
      { label: "Aceptadas", current: current.accepted, previous: previous.accepted, format: "count" },
      { label: "Rechazadas", current: current.rejected, previous: previous.rejected, format: "count" },
      { label: "Cierres", current: current.closed, previous: previous.closed, format: "count" },
      { label: "Mediana comunicación→decisión", current: current.decision, previous: previous.decision, format: "days" },
    ],
    note: "Devoluciones por fecha de comunicación; decisiones y cierres por su propia fecha.",
  };
}

export type ReturnBacklogRow = {
  id: string;
  code: string;
  communicationDate: Date | null;
  returnType: string;
  decision: ReturnTrendRow["decision"];
  nextFollowupDate: Date | null;
};

/** Devoluciones abiertas hoy; contadores con el mismo criterio que el listado. */
export function buildReturnBacklog(rows: ReturnBacklogRow[], today: Date) {
  return {
    ...buildAging(rows.map((row) => ({
      id: row.id,
      code: row.code,
      startDate: row.communicationDate,
      tags: row.decision === "PENDING" ? ["PENDING_DECISION"] : [],
      note: `${returnTypeLabel(row.returnType)}${row.decision === "PENDING" ? " · decisión pendiente" : ""}`,
    })), today),
    pendingDecision: rows.filter((row) => row.decision === "PENDING").length,
    // Mismo criterio que el listado: próximo seguimiento del último registro hoy o antes.
    followupDue: rows.filter((row) => isDue(row.nextFollowupDate, today)).length,
  };
}
