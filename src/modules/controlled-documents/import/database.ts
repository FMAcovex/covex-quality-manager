import { PrismaClient } from "@prisma/client";
// Import failures must not log workbook values or SQL diagnostics (including real codes).
const globalImport = globalThis as unknown as { controlledImportDb?: PrismaClient };
export const importDb = globalImport.controlledImportDb ?? new PrismaClient({log: [], errorFormat: "minimal"});
globalImport.controlledImportDb = importDb;
