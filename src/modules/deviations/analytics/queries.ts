import "server-only";
import { Prisma, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  buildFiveYearTrend,
  buildYearMetrics,
  type AnalyticsRow,
} from "@/modules/deviations/analytics/domain";

export type DeviationAnalyticsFilters = {
  year?: string;
  department?: string;
  classification?: string;
  provenance?: string;
  capa?: string;
  status?: string;
};

function filterWhere(filters: DeviationAnalyticsFilters): Prisma.DeviationWhereInput {
  const and: Prisma.DeviationWhereInput[] = [];

  if (filters.department) and.push({ departmentId: filters.department });
  if (["CRITICAL", "MAJOR", "MINOR"].includes(filters.classification ?? "")) {
    and.push({ classification: filters.classification as "CRITICAL" | "MAJOR" | "MINOR" });
  }
  if (filters.provenance) and.push({ provenance: filters.provenance });
  if (filters.status === "OPEN" || filters.status === "CLOSED") {
    and.push({ status: filters.status });
  }
  if (filters.capa === "yes") {
    and.push({ OR: [{ capaRequired: true }, { capaPlans: { some: {} } }] });
  }
  if (filters.capa === "no") {
    and.push({
      AND: [
        { OR: [{ capaRequired: false }, { capaRequired: null }] },
        { capaPlans: { none: {} } },
      ],
    });
  }

  return and.length ? { AND: and } : {};
}

export async function getDeviationAnalytics(filters: DeviationAnalyticsFilters) {
  const [records, departments, provenances, years, importBatches] = await Promise.all([
    prisma.deviation.findMany({
      where: filterWhere(filters),
      select: {
        issueDate: true,
        closedAt: true,
        status: true,
        classification: true,
        recurrentRootCause: true,
        affectsFinishedProduct: true,
        provenance: true,
        extraData: true,
        departmentCodeSnapshot: true,
        departmentNameSnapshot: true,
        capaRequired: true,
        qmsRecord: { select: { year: true } },
        capaPlans: { select: { id: true } },
      },
    }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.deviation.findMany({
      where: { provenance: { not: null } },
      select: { provenance: true },
      distinct: ["provenance"],
      orderBy: { provenance: "asc" },
    }),
    prisma.qmsRecord.findMany({
      where: { recordType: QmsRecordType.DEVIATION, year: { not: null } },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
    prisma.historicalImportBatch.findMany({
      where: { appliedAt: { not: null } },
      select: { years: true },
    }),
  ]);

  const rows: AnalyticsRow[] = records.map((record) => ({
    openingYear: record.qmsRecord.year ?? record.issueDate?.getUTCFullYear() ?? null,
    issueDate: record.issueDate,
    closedAt: record.closedAt,
    status: record.status,
    classification: record.classification,
    recurrentRootCause: record.recurrentRootCause,
    affectsFinishedProduct: record.affectsFinishedProduct,
    provenance:
      (() => {
        const extra = record.extraData as {
          historicalImport?: { normalizedOrigin?: unknown };
        } | null;
        const normalized = extra?.historicalImport?.normalizedOrigin;
        return typeof normalized === "string" && normalized.trim()
          ? normalized.trim()
          : record.provenance;
      })(),
    departmentCode: record.departmentCodeSnapshot,
    departmentName: record.departmentNameSnapshot,
    capaRequired: record.capaRequired,
    capaCount: record.capaPlans.length,
  }));

  const availableYears = years
    .map((item) => item.year)
    .filter((year): year is number => year !== null);
  const requestedYear = filters.year && /^\d{4}$/.test(filters.year)
    ? Number(filters.year)
    : undefined;
  const selectedYear = requestedYear ?? availableYears[0] ?? new Date().getFullYear();
  const coveredYears = new Set<number>([
    ...availableYears,
    ...importBatches.flatMap((batch) => batch.years),
  ]);
  const current = buildYearMetrics(rows, selectedYear, coveredYears.has(selectedYear));
  const previous = buildYearMetrics(rows, selectedYear - 1, coveredYears.has(selectedYear - 1));
  const trend = buildFiveYearTrend(rows, selectedYear, coveredYears);

  return {
    selectedYear,
    current,
    previous,
    trend,
    departments,
    provenances: provenances
      .map((item) => item.provenance)
      .filter((value): value is string => Boolean(value)),
    years: availableYears,
  };
}
