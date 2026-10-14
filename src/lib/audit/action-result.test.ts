import { describe, expect, it } from "vitest";
import { actionOutcome, redirectOutcome, replayActionOutcome, RejectedBusinessResult } from "./action-result";

describe("successful command responses", () => {
  it("preserves undefined, null, dates and nested action responses", () => {
    const value = { url: "/controlled-documents/fixture", omitted: undefined, empty: null, at: new Date("2026-10-13T00:00:00Z"), items: [1, true, null] };
    expect(replayActionOutcome(JSON.parse(JSON.stringify(actionOutcome(value))))).toEqual(value);
  });
  it("preserves local Next redirects and rejects external or malformed digests", () => {
    const error = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/capa/fixture;303;" });
    expect(() => replayActionOutcome(redirectOutcome(error))).toThrowError(expect.objectContaining({ digest: error.digest }));
    expect(redirectOutcome(Object.assign(new Error(), { digest: "NEXT_REDIRECT;replace;https://example.invalid;303;" }))).toBeNull();
    expect(redirectOutcome(Object.assign(new Error(), { digest: "NEXT_REDIRECT;replace;//example.invalid;303;" }))).toBeNull();
  });
  it("rejects failure states, sensitive data, binary responses and reserved type tags", () => {
    expect(() => actionOutcome({ error: "Validation failed", values: { title: "Preserved" } })).toThrow(RejectedBusinessResult);
    expect(() => actionOutcome({ token: "synthetic" })).toThrow("Sensitive");
    expect(() => actionOutcome({ fileData: new Uint8Array([1]) })).toThrow("Sensitive");
    expect(() => actionOutcome(new Uint8Array([1]))).toThrow("Unsupported");
    expect(() => actionOutcome({ $covex: "undefined" })).toThrow("Reserved");
    expect(() => actionOutcome({ text: "a".repeat(65536) })).toThrow("too large");
  });
});
