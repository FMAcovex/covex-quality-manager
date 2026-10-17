import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildMonthlyCounts, buildPareto } from "@/lib/qms/analytics/trends";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";
import {
  buildChangeBacklog,
  buildChangeFiveYearTrend,
  buildChangeYearMetrics,
  buildChangeYearToDate,
  changeScopeDistribution,
  type ChangeAnalyticsRow,
} from "@/modules/change-control/analytics/domain";

export type ChangeAnalyticsFilters = {
  year?: string;
  department?: string;
  classification?: string;
  status?: string;
};

export async function getChangeAnalytics(filters: ChangeAnalyticsFilters, today = new Date()) {
  const records = await prisma.changeControl.findMany({
    where: {
      includeInKpi: true,
      qmsRecord: { isActive: true },
      finalStatus: { not: "DRAFT" },
      ...(filters.department ? { departmentId: filters.department } : {}),
      ...(filters.classification === "MAJOR" || filters.classification === "MINOR"
        ? { classification: filters.classification }
        : {}),
      ...(filters.status === "OPEN" || filters.status === "CLOSED"
        ? { finalStatus: filters.status }
        : {}),
    },
    select: {
      requestDate: true,
      executionDate: true,
      effectiveClosedAt: true,
      finalStatus: true,
      classification: true,
      executionStatus: true,
      effectivenessStatus: true,
      departmentCodeSnapshot: true,
      plannedImplementationDate: true,
      scope: true,
      qmsRecord: { select: { year: true } },
      tasks: {
        where: { origin: "DICTAMEN" },
        select: { plannedDate: true },
      },
    },
  });

  const [departments, yearRows] = await Promise.all([
    prisma.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.qmsRecord.findMany({
      where: { recordType: "CHANGE_CONTROL", year: { not: null } },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
  ]);

  const rows: ChangeAnalyticsRow[] = records
    .filter((record) => record.finalStatus !== "DRAFT")
    .map((record) => {
    const plannedDates = record.tasks
      .map((task) => task.plannedDate)
      .filter((value): value is Date => Boolean(value));
    if (record.plannedImplementationDate) plannedDates.push(record.plannedImplementationDate);
    return {
      openingYear: record.qmsRecord.year ?? record.requestDate?.getUTCFullYear() ?? null,
      requestDate: record.requestDate,
      executionDate: record.executionDate,
      effectiveClosedAt: record.effectiveClosedAt,
      finalStatus: record.finalStatus as "OPEN" | "CLOSED",
      classification: record.classification,
      executionStatus: record.executionStatus,
      effectivenessStatus: record.effectivenessStatus,
      departmentCode: record.departmentCodeSnapshot,
      plannedDates,
      scopes: record.scope,
      };
    });

  const years = yearRows.map((row) => row.year).filter((value): value is number => value !== null);
  const selectedYear =
    filters.year && /^\d{4}$/.test(filters.year)
      ? Number(filters.year)
      : years[0] ?? new Date().getFullYear();
  const covered = new Set(years);

  const current = buildChangeYearMetrics(rows, selectedYear, covered.has(selectedYear));

  return {
    selectedYear,
    current,
    previous: buildChangeYearMetrics(rows, selectedYear - 1, covered.has(selectedYear - 1)),
    trend: buildChangeFiveYearTrend(rows, selectedYear, covered),
    // Tendencias: se calculan sobre las mismas filas, sin consultas nuevas.
    monthlySeries: buildMonthlyCounts(rows.map((row) => row.requestDate), selectedYear, covered, today),
    yearToDate: buildChangeYearToDate(rows, selectedYear, covered, today),
    pareto: {
      department: buildPareto(current.departments),
      scope: buildPareto(changeScopeDistribution(rows, selectedYear)),
      classification: buildPareto(current.classifications),
    },
    years,
    departments,
  };
}

/**
 * Controles de cambios abiertos hoy y su antigüedad. Aplica departamento y clasificación;
 * no el año analizado ni el estado final, porque lo pendiente es de hoy.
 */
export async function getChangeBacklog(filters: ChangeAnalyticsFilters, today = new Date()) {
  const where: Prisma.ChangeControlWhereInput = {
    includeInKpi: true,
    qmsRecord: { isActive: true },
    finalStatus: "OPEN",
    ...(filters.department ? { departmentId: filters.department } : {}),
    ...(filters.classification === "MAJOR" || filters.classification === "MINOR"
      ? { classification: filters.classification }
      : {}),
  };
  const records = await prisma.changeControl.findMany({
    where,
    select: {
      id: true,
      requestDate: true,
      classification: true,
      executionStatus: true,
      effectivenessStatus: true,
      plannedImplementationDate: true,
      qmsRecord: { select: { businessCode: true, annulledBusinessCode: true } },
      tasks: { where: { origin: "DICTAMEN" }, select: { plannedDate: true } },
      followups: { orderBy: [{ sequenceNumber: "desc" }, { followupDate: "desc" }], take: 1, select: { nextFollowupDate: true } },
    },
  });
  return buildChangeBacklog(records.map((record) => {
    const plannedDates = record.tasks.map((task) => task.plannedDate).filter((value): value is Date => Boolean(value));
    if (record.plannedImplementationDate) plannedDates.push(record.plannedImplementationDate);
    return {
      id: record.id,
      code: qmsRecordDisplayCode(record.qmsRecord),
      requestDate: record.requestDate,
      classification: record.classification,
      executionStatus: record.executionStatus,
      effectivenessStatus: record.effectivenessStatus,
      plannedDates,
      nextFollowupDate: record.followups[0]?.nextFollowupDate ?? null,
    };
  }), today);
}
