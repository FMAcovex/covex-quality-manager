import { afterEach, expect, it } from "vitest";
import { formatAdministrativeDate } from "./administrative-date";

const originalTimezone = process.env.TZ;
afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

it("keeps the same administrative date on a UTC server and a Madrid client at midnight", () => {
  const timestamp = "2026-10-07T22:11:00.000Z";
  process.env.TZ = "UTC";
  const server = formatAdministrativeDate(timestamp);
  process.env.TZ = "Europe/Madrid";
  expect(new Date(timestamp).toLocaleDateString("es-ES")).toBe("8/10/2026");
  expect(formatAdministrativeDate(timestamp)).toBe(server);
  expect(server).toBe("7/10/2026");
});

// FEC1: «hoy» para las fechas administrativas es el día natural de la planta (Madrid), no el día UTC del servidor.
it("takes today's administrative date from the Madrid calendar, in winter and in summer", async () => {
  const { administrativeToday, administrativeTodayDate } = await import("./administrative-date");
  process.env.TZ = "UTC";
  expect(administrativeToday(new Date("2026-11-12T23:30:00.000Z"))).toBe("2026-11-13");
  expect(administrativeToday(new Date("2026-11-12T22:59:00.000Z"))).toBe("2026-11-12");
  expect(administrativeToday(new Date("2026-07-01T22:30:00.000Z"))).toBe("2026-07-02");
  expect(administrativeToday(new Date("2026-07-01T21:59:00.000Z"))).toBe("2026-07-01");
  expect(administrativeToday(new Date("2026-12-31T23:15:00.000Z"))).toBe("2027-01-01");
  // Guardada como las fechas administrativas: medianoche UTC del día de Madrid.
  expect(administrativeTodayDate(new Date("2026-11-12T23:30:00.000Z")).toISOString()).toBe("2026-11-13T00:00:00.000Z");
  process.env.TZ = "America/New_York";
  expect(administrativeToday(new Date("2026-11-12T23:30:00.000Z"))).toBe("2026-11-13");
});

it("uses the current instant by default", async () => {
  const { vi } = await import("vitest");
  const { administrativeToday, administrativeTodayDate } = await import("./administrative-date");
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date("2026-11-12T23:30:00.000Z"));
    expect(administrativeToday()).toBe("2026-11-13");
    expect(administrativeTodayDate().toISOString()).toBe("2026-11-13T00:00:00.000Z");
  } finally { vi.useRealTimers(); }
});
