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
