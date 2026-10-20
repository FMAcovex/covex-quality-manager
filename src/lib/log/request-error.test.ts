import { describe, expect, it, vi } from "vitest";
import { handleRequestError } from "@/lib/log/request-error";

const request = { path: "/deviations/abc?q=lote-secreto", method: "GET" };
const context = { routePath: "/deviations/[id]", routeType: "render" };

describe("errores no controlados (onRequestError, BE1-B)", () => {
  it("usa el digest como ref", () => {
    const write = vi.fn();
    const ref = handleRequestError(Object.assign(new Error("x"), { digest: "2931774425" }), request, context, write);
    expect(ref).toBe("2931774425");
    const raw = write.mock.calls[0][0] as string;
    expect(JSON.parse(raw)).toMatchObject({ ref: "2931774425", event: "request.unhandled", operation: "GET /deviations/[id]", module: "render" });
    expect(raw).not.toContain("lote-secreto");
    expect(raw).not.toContain("/deviations/abc");
  });

  it("sin digest genera una E-", () => {
    const write = vi.fn();
    expect(handleRequestError(new Error("x"), request, context, write)).toMatch(/^E-[0-9a-f]{8}$/);
  });
});
