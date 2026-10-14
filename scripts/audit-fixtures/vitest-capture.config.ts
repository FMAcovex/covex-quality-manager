import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL("../../",import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("../../src",import.meta.url)) } },
  test: { environment: "node", fileParallelism: false, include: ["scripts/audit-fixtures/configuration-capture.test.ts", "scripts/audit-fixtures/module-actions-capture.test.ts", "scripts/audit-fixtures/pnt-import-capture.test.ts", "scripts/audit-fixtures/operational-actions-capture.test.ts", "scripts/audit-fixtures/audit-report-capture.test.ts"] },
});
