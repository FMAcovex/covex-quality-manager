import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { isolatedTestEnvironment } from "../../src/lib/auth/config";
import { identityContext, type Principal } from "../../src/lib/auth/context";
import { fixtureUsers } from "../auth-fixtures/constants";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const url = new URL(process.env.DATABASE_URL!);
if (!isolatedTestEnvironment() || !["127.0.0.1", "localhost"].includes(url.hostname) || !/^covex_phase4b1_test_b2_configuration_[a-f0-9]+$/.test(url.pathname.slice(1))) throw Error("Own disposable configuration fixture required");
const inspector = new PrismaClient({ log: [] });
let qa: Principal;
beforeAll(async () => {
  const { issueSession, sessionFromToken } = await import("../../src/lib/auth/session");
  qa = (await sessionFromToken((await issueSession(fixtureUsers.qa.id)).token)).principal;
});
afterAll(async () => {
  await inspector.$disconnect();
  await (await import("../../src/lib/db")).prisma.$disconnect();
});
const asQa = <T>(run: () => Promise<T>) => identityContext.run({ principal: qa, testHarness: true }, run);
const form = (fields: Record<string,string>) => {
  const result = new FormData();
  for (const [key,value] of Object.entries(fields)) result.set(key,value);
  return result;
};

it("rolls back the real configuration action and all retired versions when history fails", async () => {
  const { createDepartmentAction, updateDepartmentAction, activateFormVersionAction } = await import("../../src/modules/configuration/admin-actions");
  await asQa(() => createDepartmentAction(form({ code: "SYNTHB2", name: "Synthetic department", actor: "Spoofed actor" })));
  const department = await inspector.department.findUniqueOrThrow({ where: { code: "SYNTHB2" } });
  const history = await inspector.configurationChange.findFirstOrThrow({ where: { entityKey: "SYNTHB2" } });
  expect(history.authenticatedUserId).toBe(qa.id); expect(history.changedByText).toBe(qa.name);
  const target = await inspector.formVersion.create({ data: { module: "DEVIATION", versionCode: "SYNTHB2", effectiveFrom: new Date("2099-01-01"), status: "DRAFT", isActive: false } });
  const previous = await inspector.formVersion.findMany({ where: { module: "DEVIATION" }, orderBy: { id: "asc" } });
  const count = await inspector.configurationChange.count();
  await inspector.$executeRawUnsafe('ALTER TABLE "ConfigurationChange" ADD CONSTRAINT synthetic_configuration_failure CHECK (action=\'NEVER_A_SUCCESS\') NOT VALID');
  try {
    await expect(asQa(() => updateDepartmentAction(department.id, form({ name: "Must roll back", isActive: "true", reason: "Synthetic failure proof" })))).rejects.toThrow();
    expect(await inspector.department.findUniqueOrThrow({ where: { id: department.id } })).toEqual(department);
    await expect(asQa(() => activateFormVersionAction(target.id, form({ reason: "Synthetic activation failure proof" })))).rejects.toThrow();
    expect(await inspector.formVersion.findMany({ where: { module: "DEVIATION" }, orderBy: { id: "asc" } })).toEqual(previous);
    expect(await inspector.configurationChange.count()).toBe(count);
  } finally {
    await inspector.$executeRawUnsafe('ALTER TABLE "ConfigurationChange" DROP CONSTRAINT synthetic_configuration_failure');
  }
  await asQa(() => updateDepartmentAction(department.id, form({ name: "Committed synthetic update", isActive: "true" })));
  expect((await inspector.department.findUniqueOrThrow({ where: { id: department.id } })).name).toBe("Committed synthetic update");
  expect(await inspector.configurationChange.count()).toBe(count + 1);
});
