import "server-only";
import { prisma } from "@/lib/db";
import {
  buildChangeFiveYearTrend,
  buildChangeYearMetrics,
  type ChangeAnalyticsRow,
} from "@/modules/change-control/analytics/domain";

export type ChangeAnalyticsFilters = {
  year?: string;
  department?: string;
  classification?: string;
  status?: string;
};

export async function getChangeAnalytics(filters: ChangeAnalyticsFilters) {
  const records = await prisma.changeControl.findMany({
    where: {
      includeInKpi: true,
      qmsRecord: { isActive: true },
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

  const rows: ChangeAnalyticsRow[] = records.map((record) => {
    const plannedDates = record.tasks
      .map((task) => task.plannedDate)
      .filter((value): value is Date => Boolean(value));
    if (record.plannedImplementationDate) plannedDates.push(record.plannedImplementationDate);
    return {
      openingYear: record.qmsRecord.year ?? record.requestDate?.getUTCFullYear() ?? null,
      requestDate: record.requestDate,
      executionDate: record.executionDate,
      effectiveClosedAt: record.effectiveClosedAt,
      finalStatus: record.finalStatus,
      classification: record.classification,
      executionStatus: record.executionStatus,
      effectivenessStatus: record.effectivenessStatus,
      departmentCode: record.departmentCodeSnapshot,
      plannedDates,
    };
  });

  const years = yearRows.map((row) => row.year).filter((value): value is number => value !== null);
  const selectedYear =
    filters.year && /^\d{4}$/.test(filters.year)
      ? Number(filters.year)
      : years[0] ?? new Date().getFullYear();
  const covered = new Set(years);

  return {
    selectedYear,
    current: buildChangeYearMetrics(rows, selectedYear, covered.has(selectedYear)),
    previous: buildChangeYearMetrics(rows, selectedYear - 1, covered.has(selectedYear - 1)),
    trend: buildChangeFiveYearTrend(rows, selectedYear, covered),
    years,
    departments,
  };
}
