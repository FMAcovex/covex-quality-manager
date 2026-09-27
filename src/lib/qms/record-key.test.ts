import { describe, expect, it } from "vitest";
import { qmsBusinessKey } from "@/lib/qms/record-key";

describe("qmsBusinessKey", () => {
  it("separates identical visible codes by record type", () => {
    expect(qmsBusinessKey("deviation", "D/GC-00/001/2026")).toBe(
      "DEVIATION::D/GC-00/001/2026",
    );
    expect(qmsBusinessKey("capa", "D/GC-00/001/2026")).toBe(
      "CAPA::D/GC-00/001/2026",
    );
  });
});
