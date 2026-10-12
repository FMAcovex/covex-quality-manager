import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { DashboardModule, DashboardTrendPoint } from "./domain";

// Only opening counts are displayed here; the module analytics and their denominators stay untouched.
const sources = {
  DEVIATION: { table: "Deviation", date: "issueDate", status: "status" },
  CAPA: { table: "Capa", date: "openedAt", status: "status" },
  CHANGE_CONTROL: { table: "ChangeControl", date: "requestDate", status: "finalStatus" },
  COMPLAINT: { table: "Complaint", date: "openedAt", status: "status" },
  RETURN: { table: "ReturnRecord", date: "communicationDate", status: "status" },
} as const;

export async function dashboardTrend(module: DashboardModule, year: number, department: string): Promise<DashboardTrendPoint[]> {
  if (!(module in sources)) return [];
  const key = module as keyof typeof sources;
  const source = sources[key];
  // Identifiers come exclusively from the constant module mapping, never query input.
  const rows = await prisma.$queryRaw<Array<{ year: number; total: number; dataAvailable: boolean }>>(Prisma.sql`
    WITH coverage AS (
      SELECT DISTINCT q.year FROM "QmsRecord" q WHERE q."recordType"::text = ${key} AND q.year IS NOT NULL
      UNION
      SELECT unnest(b.years) FROM "HistoricalImportBatch" b WHERE b."appliedAt" IS NOT NULL
        AND (${key} = 'DEVIATION' OR (${key} = 'CAPA' AND b."recordType"::text = 'CAPA'))
    ), counts AS (
      SELECT COALESCE(q.year, EXTRACT(YEAR FROM r.${Prisma.raw('"' + source.date + '"')})::int) AS year, COUNT(*)::int AS total
      FROM ${Prisma.raw('"' + source.table + '"')} r JOIN "QmsRecord" q ON q.id = r."qmsRecordId"
      WHERE r."includeInKpi" = true AND q."isActive" = true AND r.${Prisma.raw('"' + source.status + '"')}::text <> 'DRAFT'
        ${department ? Prisma.sql`AND r."departmentId" = ${department}` : Prisma.empty}
      GROUP BY 1
    )
    SELECT y.year, COALESCE(c.total, 0)::int AS total, EXISTS(SELECT 1 FROM coverage v WHERE v.year = y.year) AS "dataAvailable"
    FROM generate_series(${year - 4}::int, ${year}::int) y(year) LEFT JOIN counts c ON c.year = y.year ORDER BY y.year
  `);
  return rows.map(row => ({ ...row, total: row.dataAvailable ? row.total : null }));
}
