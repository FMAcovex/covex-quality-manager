import { Prisma, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readXlsxSheet } from "@/modules/deviations/import/xlsx-reader";
import {
  mapHistoricalRows,
  workbookSha256,
  type HistoricalDeviationRow,
} from "@/modules/deviations/import/legacy-mapping";

type ImportMode = "dry-run" | "apply";

export type HistoricalImportReportRow = {
  sourceSheet: string;
  sourceRow: number;
  businessCode: string | null;
  result: "IMPORTABLE" | "REVIEW_REQUIRED" | "SKIPPED_DUPLICATE" | "REJECTED";
  issues: string[];
};

export type HistoricalImportReport = {
  mode: ImportMode;
  sourceFileName: string;
  sourceSha256: string;
  years: number[];
  generatedAt: string;
  counts: {
    total: number;
    importable: number;
    reviewRequired: number;
    duplicates: number;
    rejected: number;
    imported: number;
  };
  rows: HistoricalImportReportRow[];
  batchId?: string;
};

function importBlockingIssues(row: HistoricalDeviationRow) {
  return row.issues.filter((issue) =>
    ["MISSING_DEPARTMENT", "MISSING_BUSINESS_CODE", "MISSING_DESCRIPTION", "MISSING_OR_INVALID_OPENING_DATE", "DUPLICATE_CODE_IN_SOURCE"].includes(issue),
  );
}

function qualityStatus(row: HistoricalDeviationRow) {
  return importBlockingIssues(row).length ? "INCOMPLETE" as const : "REVIEW_REQUIRED" as const;
}

function sourceSnapshot(row: HistoricalDeviationRow): Prisma.InputJsonObject {
  return {
    sheet: row.sourceSheet,
    row: row.sourceRow,
    raw: row.raw as Prisma.InputJsonObject,
    issues: row.issues,
  };
}

export async function analyzeHistoricalImport(
  buffer: Buffer,
  sourceFileName: string,
  years = [2025, 2026],
) {
  const rows2025 = years.includes(2025) ? readXlsxSheet(buffer, "2025") : [];
  const rows2026 = years.includes(2026) ? readXlsxSheet(buffer, "2026") : [];
  const mapped = mapHistoricalRows(rows2025, rows2026);

  const codes = mapped.map((row) => row.businessCode).filter((code): code is string => Boolean(code));
  const existing = codes.length
    ? await prisma.qmsRecord.findMany({
        where: { recordType: QmsRecordType.DEVIATION, businessCode: { in: codes } },
        select: { id: true, businessCode: true },
      })
    : [];
  const existingByCode = new Map(existing.map((item) => [item.businessCode!, item.id]));

  const rows: HistoricalImportReportRow[] = mapped.map((row) => {
    const blocking = importBlockingIssues(row);
    if (blocking.length) {
      return { sourceSheet: row.sourceSheet, sourceRow: row.sourceRow, businessCode: row.businessCode, result: "REJECTED", issues: row.issues };
    }
    if (row.businessCode && existingByCode.has(row.businessCode)) {
      return { sourceSheet: row.sourceSheet, sourceRow: row.sourceRow, businessCode: row.businessCode, result: "SKIPPED_DUPLICATE", issues: [...row.issues, "DUPLICATE_CODE_IN_DATABASE"] };
    }
    return {
      sourceSheet: row.sourceSheet,
      sourceRow: row.sourceRow,
      businessCode: row.businessCode,
      result: row.issues.length ? "REVIEW_REQUIRED" : "IMPORTABLE",
      issues: row.issues,
    };
  });

  return {
    mapped,
    existingByCode,
    report: {
      mode: "dry-run" as const,
      sourceFileName,
      sourceSha256: workbookSha256(buffer),
      years,
      generatedAt: new Date().toISOString(),
      counts: {
        total: rows.length,
        importable: rows.filter((row) => row.result === "IMPORTABLE").length,
        reviewRequired: rows.filter((row) => row.result === "REVIEW_REQUIRED").length,
        duplicates: rows.filter((row) => row.result === "SKIPPED_DUPLICATE").length,
        rejected: rows.filter((row) => row.result === "REJECTED").length,
        imported: 0,
      },
      rows,
    } satisfies HistoricalImportReport,
  };
}

export async function applyHistoricalImport(
  buffer: Buffer,
  sourceFileName: string,
  actor: string,
  years = [2025, 2026],
): Promise<HistoricalImportReport> {
  const analyzed = await analyzeHistoricalImport(buffer, sourceFileName, years);
  const sourceByKey = new Map(analyzed.mapped.map((row) => [`${row.sourceSheet}:${row.sourceRow}`, row]));

  const batch = await prisma.historicalImportBatch.create({
    data: {
      sourceFileName,
      sourceSha256: analyzed.report.sourceSha256,
      years,
      importedByText: actor,
      totalRows: analyzed.report.counts.total,
      duplicateRows: analyzed.report.counts.duplicates,
      rejectedRows: analyzed.report.counts.rejected,
      reviewRows: analyzed.report.counts.reviewRequired,
      report: analyzed.report as unknown as Prisma.InputJsonValue,
    },
  });

  let imported = 0;

  for (const resultRow of analyzed.report.rows) {
    const source = sourceByKey.get(`${resultRow.sourceSheet}:${resultRow.sourceRow}`)!;
    if (resultRow.result === "REJECTED") {
      await prisma.historicalImportRow.create({
        data: {
          batchId: batch.id,
          sourceSheet: source.sourceSheet,
          sourceRow: source.sourceRow,
          businessCode: source.businessCode,
          result: "REJECTED",
          issues: source.issues,
          sourceSnapshot: sourceSnapshot(source),
        },
      });
      continue;
    }

    const duplicateId = source.businessCode ? analyzed.existingByCode.get(source.businessCode) : undefined;
    if (duplicateId) {
      await prisma.historicalImportRow.create({
        data: {
          batchId: batch.id,
          qmsRecordId: duplicateId,
          sourceSheet: source.sourceSheet,
          sourceRow: source.sourceRow,
          businessCode: source.businessCode,
          result: "SKIPPED_DUPLICATE",
          issues: [...source.issues, "DUPLICATE_CODE_IN_DATABASE"],
          sourceSnapshot: sourceSnapshot(source),
        },
      });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      let department = await tx.department.findUnique({ where: { code: source.departmentCode! } });
      if (!department) {
        department = await tx.department.create({
          data: {
            code: source.departmentCode!,
            name: source.departmentName ?? source.departmentCode!,
          },
        });
      }

      const qmsRecord = await tx.qmsRecord.create({
        data: {
          recordType: QmsRecordType.DEVIATION,
          businessCode: source.businessCode,
          year: source.year,
        },
      });

      await tx.deviation.create({
        data: {
          qmsRecordId: qmsRecord.id,
          departmentId: department.id,
          departmentCodeSnapshot: source.departmentCode,
          departmentNameSnapshot: source.departmentName ?? department.name,
          issueDate: source.issueDate,
          materialProcessAffected: source.materialProcessAffected,
          provenance: source.provenance,
          whatHappened: source.description,
          rootCause: source.rootCause,
          classification: source.classification,
          recurrentRootCause: source.recurrentRootCause,
          affectsFinishedProduct: source.affectsFinishedProduct,
          closedAt: source.closedAt,
          status: source.status,
          deadlineStatus: source.deadlineStatus,
          internalObservations: source.internalObservations,
          signedDocumentAvailable: source.signedDocumentAvailable,
          dataQualityStatus: qualityStatus(source),
          capaRequired: /CAPA/i.test(source.measuresRaw ?? "") ? true : null,
          extraData: {
            historicalImport: {
              sourceFileName,
              sourceSha256: analyzed.report.sourceSha256,
              sourceSheet: source.sourceSheet,
              sourceRow: source.sourceRow,
              measuresRaw: source.measuresRaw,
              capaRaw: source.capaRaw,
              normalizedOrigin: source.normalizedOrigin,
              issues: source.issues,
              raw: source.raw,
            },
          },
          immediateActions: source.immediateActionRaw
            ? { create: [{ description: source.immediateActionRaw, sortOrder: 0 }] }
            : undefined,
          capaPlans: source.capaPlans.length
            ? {
                create: source.capaPlans.map((plan) => ({
                  actionType: plan.actionType,
                  description: plan.description,
                  businessCapaCode: plan.businessCapaCode,
                  proposalStatus: "REGISTERED",
                })),
              }
            : undefined,
        },
      });

      await tx.changeHistory.create({
        data: {
          qmsRecordId: qmsRecord.id,
          changedByText: actor,
          fieldPath: "__historical_import__",
          newValue: sourceSnapshot(source),
          reason: `Importación histórica desde ${sourceFileName} · ${source.sourceSheet} fila ${source.sourceRow}`,
          source: "IMPORT",
        },
      });

      await tx.historicalImportRow.create({
        data: {
          batchId: batch.id,
          qmsRecordId: qmsRecord.id,
          sourceSheet: source.sourceSheet,
          sourceRow: source.sourceRow,
          businessCode: source.businessCode,
          result: source.issues.length ? "REVIEW_REQUIRED" : "IMPORTED",
          issues: source.issues,
          sourceSnapshot: sourceSnapshot(source),
        },
      });
    });
    imported += 1;
  }

  const report: HistoricalImportReport = {
    ...analyzed.report,
    mode: "apply",
    batchId: batch.id,
    generatedAt: new Date().toISOString(),
    counts: { ...analyzed.report.counts, imported },
  };

  await prisma.historicalImportBatch.update({
    where: { id: batch.id },
    data: {
      appliedAt: new Date(),
      importedRows: imported,
      report: report as unknown as Prisma.InputJsonValue,
    },
  });

  return report;
}
