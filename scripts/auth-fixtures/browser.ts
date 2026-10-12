import { chromium as realChromium, type Browser, type BrowserContext, type Page, type Locator } from "playwright";
import { fixtureLogin } from "./http";
import { fixtureUsers } from "./constants";
import { authConfiguration } from "../../src/lib/auth/config";
import { isolatedTestEnvironment } from "../../src/lib/auth/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import type { AccessPermission } from "../../src/lib/auth/context";
const preparedRequests = new WeakSet<object>();
export async function assertCorporateActor(field: Locator) {
  const response = await field.page().request.get(authConfiguration().origin + "/api/auth/session");
  const user = await response.json();
  if (!response.ok() || await field.inputValue() !== user.name || await field.getAttribute("readonly") === null) throw new Error("El ejecutor visible debe ser la identidad autenticada y no editable.");
}
function prepareDirectApiRequests(context: BrowserContext) {
  if (preparedRequests.has(context.request)) return;
  preparedRequests.add(context.request);
  for (const method of ["post", "put", "patch", "delete"] as const) {
    const original = context.request[method].bind(context.request);
    context.request[method] = async (url, options = {}) => {
      const csrf = (await context.cookies()).find(c => c.name === "covex-csrf")?.value ?? "";
      return original(url, { ...options, headers: { origin: authConfiguration().origin, ...options.headers, "x-covex-csrf": csrf } });
    };
  }
}

export async function authenticateContext(context: BrowserContext, user: keyof typeof fixtureUsers = "qa") {
  const login = await fixtureLogin(user); if (!login.success) throw new Error("Synthetic browser login failed.");
  const config = authConfiguration();
  await context.addCookies([...login.jar].filter(([name]) => ["covex-session", "covex-csrf"].includes(name)).map(([name, value]) => ({ name, value, url: config.origin, httpOnly: name === "covex-session", sameSite: "Lax" as const })));
  prepareDirectApiRequests(context);
}
export async function authenticatedPage(browser: Browser, user: keyof typeof fixtureUsers = "qa", options: Parameters<Browser["newPage"]>[0] = {}) {
  const page = await browser.newPage(options); await authenticateContext(page.context(), user); return page;
}
// Existing regression suites explicitly import this test-only launcher. Every
// context starts with an OIDC-created server session and explicit fixture grants.
export const chromium = {
  async launch(options?: Parameters<typeof realChromium.launch>[0]) {
    const browser = await realChromium.launch(options), createContext = browser.newContext.bind(browser), createPage = browser.newPage.bind(browser);
    browser.newContext = async opts => { const context = await createContext(opts); await authenticateContext(context); return context; };
    browser.newPage = async opts => { const page = await createPage(opts); if (!(await page.context().cookies()).some(c => c.name === "covex-session")) await authenticateContext(page.context()); return page; };
    return browser;
  },
};
export async function anonymousPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage(); await page.context().clearCookies(); return page;
}
export async function capabilityPage(browser: Browser, capabilities: AccessPermission[]) {
  if (!isolatedTestEnvironment()) throw new Error("Capability fixtures require an isolated database.");
  const id = randomUUID(), config = authConfiguration();
  const role = await prisma.authRole.create({ data: { key: "FIXTURE_CAP_" + id, name: "Capacidad sintética aislada", qaAcceptedAt: new Date(), qaAcceptedBy: "ISOLATED_TEST_FIXTURE", permissions: { create: capabilities.map(permission => ({ module: "PNT", permission, scope: "ALL" })) } } });
  await prisma.authUser.create({ data: { tenantId: config.tenantId, objectId: id, displayName: "Usuario sintético de capacidad 4B1", email: "capability@example.invalid", active: true, authorizedAt: new Date(), roles: { create: { roleId: role.id } } } });
  const login = await fixtureLogin("qa", "", id); if (!login.success) throw new Error("Capability fixture OIDC login failed.");
  const page = await anonymousPage(browser);
  await page.context().addCookies([...login.jar].filter(([name]) => ["covex-session", "covex-csrf"].includes(name)).map(([name, value]) => ({ name, value, url: config.origin, httpOnly: name === "covex-session", sameSite: "Lax" as const })));
  prepareDirectApiRequests(page.context());
  return page;
}
