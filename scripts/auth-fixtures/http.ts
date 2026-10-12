import { authConfiguration, isolatedTestEnvironment } from "../../src/lib/auth/config";
import { fixtureUsers } from "./constants";
export type FixtureCookieJar = Map<string, string>;
export function cookieHeader(jar: FixtureCookieJar) { return [...jar].map(([k, v]) => k + "=" + v).join("; "); }
export async function fixtureLogin(user: keyof typeof fixtureUsers = "qa", testCase = "", objectId?: string) {
  const config = authConfiguration();
  if (!config.synthetic || !isolatedTestEnvironment()) throw new Error("Synthetic login refused.");
  const jar: FixtureCookieJar = new Map([["fixture_oid", objectId ?? fixtureUsers[user].oid], ["fixture_case", testCase]]);
  let url = config.origin + "/auth/login", callback = "", success = false;
  for (let i = 0; i < 4; i++) {
    const response = await fetch(url, { redirect: "manual", headers: { cookie: cookieHeader(jar) } });
    for (const cookie of response.headers.getSetCookie()) { const entry = cookie.split(";", 1)[0], separator = entry.indexOf("="); jar.set(entry.slice(0, separator), entry.slice(separator + 1)); }
    const location = response.headers.get("location");
    if (new URL(url).pathname === "/auth/callback") { callback = url; success = Boolean(jar.get("covex-session")) && Boolean(location && new URL(location, config.origin).pathname === "/"); break; }
    if (!location) break;
    url = new URL(location, url).href;
  }
  return { jar, success, callback };
}
export async function fixtureRequest(jar: FixtureCookieJar, path: string, init: RequestInit = {}) {
  const config = authConfiguration(), url = new URL(path, config.origin);
  if (!isolatedTestEnvironment() || url.origin !== config.origin) throw new Error("Fixture requests must remain in the local test app.");
  const headers = new Headers(init.headers); headers.set("cookie", cookieHeader(jar));
  if (init.method && !["GET", "HEAD"].includes(init.method)) { headers.set("origin", config.origin); headers.set("x-covex-csrf", jar.get("covex-csrf") ?? ""); }
  return fetch(url, { ...init, headers, redirect: init.redirect ?? "manual" });
}
