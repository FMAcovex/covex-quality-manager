import { isolatedTestEnvironment } from "../../src/lib/auth/config";
import { identityContext, accessModules, permissions } from "../../src/lib/auth/context";
import { fixtureUsers, syntheticTenant } from "./constants";
if (!isolatedTestEnvironment()) throw new Error("Synthetic action harness refused outside isolated automated tests.");
const user = fixtureUsers.qa;
identityContext.enterWith({ testHarness: true, principal: { id: user.id, tenantId: syntheticTenant, objectId: user.oid, name: user.name, email: "qa@example.invalid", active: true, authorized: true, roles: [user.role], grants: accessModules.flatMap(module => permissions.map(permission => ({ module, permission, scope: "ALL" }))), departmentIds: [], assignments: [] } });
