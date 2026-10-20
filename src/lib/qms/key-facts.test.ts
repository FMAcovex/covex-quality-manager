import { describe, expect, it } from "vitest";
import { dueTone } from "./key-facts";

describe("Tono de los plazos en los datos clave", () => {
  const today = new Date("2026-10-19");
  it("marca vencido, próximo (30 días) o nada", () => {
    expect(dueTone(new Date("2026-10-18"), today, false)).toBe("overdue");
    expect(dueTone(new Date("2026-11-10"), today, false)).toBe("upcoming");
    expect(dueTone(new Date("2026-12-31"), today, false)).toBeNull();
  });
  it("no colorea un expediente cerrado ni una fecha vacía", () => {
    expect(dueTone(new Date("2026-10-01"), today, true)).toBeNull();
    expect(dueTone(null, today, false)).toBeNull();
    expect(dueTone(undefined, today, false)).toBeNull();
  });
});
