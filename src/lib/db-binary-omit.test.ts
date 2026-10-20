import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { binaryOmit } from "@/lib/db-binary-omit";

const root = path.resolve(__dirname, "../..");

/**
 * Archivos que leen o escriben bytes de fichero (BE1-A, D-112). Cada uno pide los bytes de forma expresa
 * (`omit: withBytes` o `select: { fileData: true }`) o solo los escribe. Un archivo nuevo aquí exige revisarlo.
 */
const REVIEWED_BINARY_CONSUMERS = [
  "src/app/api/audit-trail/exports/[id]/route.ts",
  "src/app/api/audits/[id]/documents/route.ts",
  "src/app/api/audits/plans/[id]/programmes/[versionId]/route.ts",
  "src/app/api/capa/[id]/versions/[sequence]/signed-pdf/route.ts",
  "src/app/api/changes/[id]/versions/[sequence]/signed-pdf/route.ts",
  "src/app/api/complaints/[id]/versions/[sequence]/signed-pdf/route.ts",
  "src/app/api/controlled-documents/[id]/revisions/[revisionId]/documents/[objectId]/route.ts",
  "src/app/api/deviations/[id]/versions/[sequence]/signed-pdf/route.ts",
  "src/app/api/oos/[id]/signed-pdf/[annex]/route.ts",
  "src/app/api/qms/[id]/document-originals/[custodyId]/route.ts",
  "src/app/api/qms/[id]/evidence/[documentId]/route.ts",
  "src/app/api/returns/[id]/documents/[documentId]/route.ts",
  "src/app/api/returns/[id]/signed-pdf/[annex]/route.ts",
  "src/lib/audit/action-result.ts",
  "src/lib/audit/trail-actions.ts",
  "src/lib/qms/record-evidence.ts",
  "src/lib/qms/signed-version-document.ts",
  "src/modules/audits/annual-programme/service.ts",
  "src/modules/audits/capa-plan-service.ts",
  "src/modules/audits/documents/service.ts",
  "src/modules/audits/report-service.ts",
  "src/modules/configuration/admin-actions.ts",
  "src/modules/configuration/template-assets.ts",
  "src/modules/configuration/template-install-service.ts",
  "src/modules/controlled-documents/documents/service.ts",
  "src/modules/controlled-documents/lifecycle/service.ts",
  "src/modules/returns/documents/archive.ts",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("ficheros fuera de las lecturas por defecto (BE1-A)", () => {
  it("binaryOmit cubre exactamente los modelos con Bytes", () => {
    const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
    const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
      .filter(([, , body]) => /^\s+\w+\s+Bytes\??\s/m.test(body))
      .map(([, name]) => name[0].toLowerCase() + name.slice(1))
      .sort();
    expect(Object.keys(binaryOmit).sort()).toEqual(models);
    for (const model of models) expect(binaryOmit[model as keyof typeof binaryOmit]).toEqual({ fileData: true });
  });

  it("solo los consumidores revisados leen bytes", () => {
    const readers = sourceFiles(path.join(root, "src"))
      .filter(file => !file.endsWith(path.join("lib", "db-binary-omit.ts")) && readFileSync(file, "utf8").includes("fileData"))
      .map(file => path.relative(root, file).split(path.sep).join("/"))
      .sort();
    expect(readers).toEqual([...REVIEWED_BINARY_CONSUMERS].sort());
  });
});
