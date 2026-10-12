import { beforeEach, afterEach, expect } from "vitest";
import { identityContext, accessModules, permissions } from "./lib/auth/context";
// Existing pure unit tests run as an explicit principal. Security tests select
// their own identities and never inherit this fixture. No production entrypoint.
beforeEach(() => {
  process.env.APP_ENV = "test";
  if (expect.getState().testPath?.includes("/lib/auth/")) { identityContext.enterWith(undefined as never); return; }
  identityContext.enterWith({ unitTest: true, principal: {
    id: "44444444-4444-4444-8444-444444444441", tenantId: "11111111-1111-4111-8111-111111111111", objectId: "33333333-3333-4333-8333-333333333331",
    name: "Usuario sintético QA 4B1", email: "qa@example.invalid", active: true, authorized: true, roles: ["QUALITY_ASSURANCE"],
    grants: accessModules.flatMap(module => permissions.map(permission => ({ module, permission, scope: "ALL" }))), departmentIds: [], assignments: [],
  } });
});
afterEach(() => identityContext.enterWith(undefined as never));
