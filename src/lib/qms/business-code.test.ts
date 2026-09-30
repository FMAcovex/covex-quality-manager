import { describe, expect, it } from "vitest";
import {
  buildDeviationCode,
  deviationCodePrefix,
  extractDeviationSequence,
} from "@/lib/qms/business-code";

describe("business-code", () => {
  it("genera el formato D/XX-NN/ZZZ/YYYY", () => {
    expect(buildDeviationCode("GC-00", 15, 2026)).toBe("D/GC-00/015/2026");
    expect(deviationCodePrefix("PM-10")).toBe("D/PM-10/");
  });

  it("extrae solo correlativos del departamento y año correctos", () => {
    expect(extractDeviationSequence("D/GC-00/015/2026", "GC-00", 2026)).toBe(15);
    expect(extractDeviationSequence("D/PM-10/015/2026", "GC-00", 2026)).toBeNull();
    expect(extractDeviationSequence("D/GC-00/015/2025", "GC-00", 2026)).toBeNull();
    expect(extractDeviationSequence("DEMO-DES-001-2026", "GC-00", 2026)).toBeNull();
  });

  it("rechaza correlativos fuera del rango de tres cifras", () => {
    expect(() => buildDeviationCode("GC-00", 0, 2026)).toThrow();
    expect(() => buildDeviationCode("GC-00", 1000, 2026)).toThrow();
  });
});
