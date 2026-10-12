/** Real OIDC protocol for loopback tests; ephemeral signing keys and one-use codes. */
import { createServer } from "node:http";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { authConfiguration, isolatedTestEnvironment } from "../../src/lib/auth/config";
import { fixtureUsers } from "./constants";

export async function startSyntheticProvider() {
  const config = authConfiguration();
  if (!config.synthetic || !isolatedTestEnvironment()) throw new Error("Synthetic OIDC is confined to isolated tests.");
  const { publicKey, privateKey } = await generateKeyPair("RS256"), jwk = await exportJWK(publicKey), kid = randomUUID();
  const issuer = config.issuer.origin, codes = new Map<string, { challenge: string; nonce: string; oid: string; redirect: string; testCase: string; expires: number }>();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", issuer);
    const json = (body: unknown, status = 200) => { response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end(JSON.stringify(body)); };
    try {
      if (url.pathname === "/.well-known/openid-configuration") return json({ issuer, authorization_endpoint: issuer + "/authorize", token_endpoint: issuer + "/token", jwks_uri: issuer + "/jwks", end_session_endpoint: issuer + "/logout", response_types_supported: ["code"], subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"], token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"], code_challenge_methods_supported: ["S256"] });
      if (url.pathname === "/jwks") return json({ keys: [{ ...jwk, kid, use: "sig", alg: "RS256" }] });
      if (url.pathname === "/logout") { const location = url.searchParams.get("post_logout_redirect_uri"); if (location !== config.origin + "/login") return json({ error: "invalid_redirect" }, 400); response.writeHead(302, { location }); return response.end(); }
      if (url.pathname === "/authorize") {
        const query = url.searchParams, redirect = query.get("redirect_uri");
        if (redirect !== config.origin + "/auth/callback" || query.get("client_id") !== config.clientId || query.get("code_challenge_method") !== "S256" || !query.get("nonce") || !query.get("state")) return json({ error: "invalid_request" }, 400);
        const cookies = Object.fromEntries((request.headers.cookie ?? "").split(";").map(s => s.trim().split("=")));
        const code = randomUUID(), testCase = cookies.fixture_case ?? "";
        codes.set(code, { challenge: query.get("code_challenge")!, nonce: query.get("nonce")!, oid: cookies.fixture_oid ?? fixtureUsers.qa.oid, redirect, testCase, expires: Date.now() + 60000 });
        const target = new URL(redirect); target.searchParams.set("code", code); target.searchParams.set("state", testCase === "state" ? randomUUID() : query.get("state")!);
        response.writeHead(302, { location: target.toString() }); return response.end();
      }
      if (url.pathname === "/token" && request.method === "POST") {
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of request) { size += chunk.length; if (size > 8192) return json({ error: "invalid_request" }, 400); chunks.push(chunk); }
        const form = new URLSearchParams(Buffer.concat(chunks).toString()), code = codes.get(form.get("code") ?? ""); codes.delete(form.get("code") ?? "");
        const basic = Buffer.from((request.headers.authorization ?? "").replace(/^Basic /, ""), "base64").toString().split(":");
        const suppliedSecret = form.get("client_secret") ?? basic[1] ?? "", suppliedId = form.get("client_id") ?? basic[0];
        const a = Buffer.from(suppliedSecret), b = Buffer.from(config.secret);
        if (!code || code.expires < Date.now() || suppliedId !== config.clientId || a.length !== b.length || !timingSafeEqual(a, b) || form.get("redirect_uri") !== code.redirect || createHash("sha256").update(form.get("code_verifier") ?? "").digest("base64url") !== code.challenge) return json({ error: "invalid_grant" }, 400);
        const key = code.testCase === "signature" ? (await generateKeyPair("RS256")).privateKey : privateKey;
        const token = await new SignJWT({ tid: code.testCase === "tenant" ? randomUUID() : config.tenantId, oid: code.oid, nonce: code.testCase === "nonce" ? randomUUID() : code.nonce }).setProtectedHeader({ alg: "RS256", kid }).setIssuer(code.testCase === "issuer" ? "http://127.0.0.1:1" : issuer).setAudience(code.testCase === "audience" ? randomUUID() : config.clientId).setSubject(code.oid).setIssuedAt().setExpirationTime(code.testCase === "expired" ? "-1h" : "5m").sign(key);
        return json({ access_token: randomUUID(), token_type: "Bearer", expires_in: 300, id_token: token });
      }
      return json({ error: "not_found" }, 404);
    } catch { return json({ error: "invalid_request" }, 400); }
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(Number(config.issuer.port), "127.0.0.1", resolve); });
  return server;
}
if (process.argv[1]?.endsWith("/auth-fixtures/provider.ts")) startSyntheticProvider().then(server => { console.log("Isolated synthetic OIDC ready on loopback."); process.on("SIGTERM", () => server.close()); }).catch(() => { console.error("Synthetic provider refused or unavailable."); process.exitCode = 1; });
