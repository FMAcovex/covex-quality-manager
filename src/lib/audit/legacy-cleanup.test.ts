import { expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { purgeLegacyFixtureDocuments } from "../../../scripts/audit-fixtures/legacy-cleanup";

it("refuses habitual/production or empty fixture scopes before any SQL teardown", async () => {
  const db = { $transaction: vi.fn() } as unknown as PrismaClient;
  for (const env of [
    { APP_ENV: "production", AUTH_SYNTHETIC_IDENTITY: "1", DATABASE_URL: "postgresql://dummy@localhost/covex_phase4b1_test_not_allowed" },
    { APP_ENV: "test", AUTH_SYNTHETIC_IDENTITY: "1", DATABASE_URL: "postgresql://dummy@localhost/covex_quality" },
    { APP_ENV: "test", AUTH_SYNTHETIC_IDENTITY: "1", DATABASE_URL: "postgresql://dummy@corporate.invalid/covex_phase4b1_test_not_allowed" },
  ]) await expect(purgeLegacyFixtureDocuments(db, { id: "fixture" }, env)).rejects.toThrow();
  await expect(purgeLegacyFixtureDocuments(db, {}, { APP_ENV: "test", AUTH_SYNTHETIC_IDENTITY: "1", DATABASE_URL: "postgresql://dummy@localhost/covex_phase4b1_test_empty" })).rejects.toThrow();
  expect(db.$transaction).not.toHaveBeenCalled();
});
