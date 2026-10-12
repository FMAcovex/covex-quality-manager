import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

describe("securityHeaders", () => {
  it("includes the baseline anti-sniffing, framing and privacy headers", () => {
    const names = new Set(securityHeaders.map((header) => header.key));
    expect(names.has("X-Content-Type-Options")).toBe(true);
    expect(names.has("X-Frame-Options")).toBe(true);
    expect(names.has("Referrer-Policy")).toBe(true);
    expect(names.has("Permissions-Policy")).toBe(true);
    expect(names.has("X-Robots-Tag")).toBe(true);
    expect(securityHeaders.find(header => header.key === "Referrer-Policy")?.value).toBe("same-origin");
  });

  it("does not contain duplicate header names", () => {
    const names = securityHeaders.map((header) => header.key.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});
