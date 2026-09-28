import { describe, expect, it } from "vitest";
import { backupChecksum, normalizeBackupValue } from "./backup";

describe("logical backup helpers", () => {
  it("serializes dates and bytes without losing their type", () => {
    const normalized = normalizeBackupValue({
      at: new Date("2026-09-28T08:00:00.000Z"),
      bytes: Uint8Array.from([1, 2, 3]),
    });

    expect(normalized).toEqual({
      at: { $type: "Date", value: "2026-09-28T08:00:00.000Z" },
      bytes: { $type: "Bytes", encoding: "base64", value: "AQID" },
    });
  });

  it("produces a stable SHA-256 checksum", () => {
    const payload = { a: 1, b: ["x", "y"] };
    expect(backupChecksum(payload)).toBe(backupChecksum(payload));
    expect(backupChecksum(payload)).toHaveLength(64);
  });
});
