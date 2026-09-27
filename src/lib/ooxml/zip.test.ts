import { describe, expect, it } from "vitest";
import { readZip, writeZip } from "@/lib/ooxml/zip";

describe("OOXML ZIP", () => {
  it("roundtrips UTF-8 and binary entries", () => {
    const original = [
      { name: "a.xml", data: Buffer.from("<a>á</a>") },
      { name: "bin.dat", data: Buffer.from([0, 1, 2, 255]) },
    ];
    const parsed = readZip(writeZip(original));
    expect(parsed.map((entry) => entry.name)).toEqual(["a.xml", "bin.dat"]);
    expect(parsed[0].data.toString()).toBe("<a>á</a>");
    expect([...parsed[1].data]).toEqual([0, 1, 2, 255]);
  });
});
