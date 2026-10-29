import { describe, expect, it } from "vitest";
import { calendarDayKey, calendarRange, calendarTitle, groupByDay, parseCalendarQuery, shiftAnchor, sortCalendarItems, weekStart, type CalendarItem } from "./calendar-domain";

// D-120: periodos del calendario (semanas de lunes a domingo, UTC) y lectura de la URL.
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const modules = ["DEVIATION", "CAPA", "PNT"] as const;

describe("Calendario de vencimientos", () => {
  it("el mes se pinta en semanas completas de lunes a domingo", () => {
    const range = calendarRange("month", d("2026-10-15"));
    expect(calendarDayKey(range.from)).toBe("2026-09-28");
    expect(calendarDayKey(range.to)).toBe("2026-11-02");
    expect(range.days).toHaveLength(35);
    expect(calendarDayKey(range.days[0])).toBe("2026-09-28");
    expect(calendarDayKey(range.days.at(-1)!)).toBe("2026-11-01");
  });

  it("un mes que empieza en lunes no añade la semana anterior; febrero puede ocupar 4 semanas", () => {
    expect(calendarDayKey(calendarRange("month", d("2027-02-10")).from)).toBe("2027-02-01");
    expect(calendarRange("month", d("2027-02-10")).days).toHaveLength(28);
    expect(calendarRange("month", d("2026-08-01")).days).toHaveLength(42);
  });

  it("la semana va de lunes a domingo y el domingo pertenece a la semana anterior", () => {
    expect(calendarDayKey(weekStart(d("2026-11-01")))).toBe("2026-10-26");
    const range = calendarRange("week", d("2026-10-28"));
    expect([calendarDayKey(range.from), calendarDayKey(range.to)]).toEqual(["2026-10-26", "2026-11-02"]);
  });

  it("anterior y siguiente mueven un mes o una semana", () => {
    expect(calendarDayKey(shiftAnchor("month", d("2026-01-31"), 1))).toBe("2026-02-01");
    expect(calendarDayKey(shiftAnchor("month", d("2026-01-15"), -1))).toBe("2025-12-01");
    expect(calendarDayKey(shiftAnchor("week", d("2026-10-28"), 1))).toBe("2026-11-04");
  });

  it("lee la URL y descarta valores no válidos", () => {
    const today = new Date("2026-10-29T15:00:00Z");
    expect(parseCalendarQuery({}, today, modules)).toEqual({ view: "month", anchor: d("2026-10-29"), module: "ALL", department: "", scope: "all" });
    const parsed = parseCalendarQuery({ view: "week", date: "2026-02-31", module: "OTRO", scope: "mine" }, today, modules);
    expect(parsed.view).toBe("week");
    expect(calendarDayKey(parsed.anchor)).toBe("2026-10-29");
    expect(parsed.module).toBe("ALL");
    expect(parsed.scope).toBe("mine");
    expect(parseCalendarQuery({ module: "PNT", date: "2026-12-01" }, today, modules).module).toBe("PNT");
  });

  it("títulos en español y agrupación por día ordenada", () => {
    expect(calendarTitle("month", d("2026-10-01"))).toBe("Octubre de 2026");
    expect(calendarTitle("week", d("2026-10-28"))).toBe("Semana del 26/10/2026 al 01/11/2026");
    const item = (key: string, date: string, code = "C"): CalendarItem => ({ key, module: "CAPA", code, label: "", detail: "", date: d(date), overdue: false, href: "/" });
    const sorted = sortCalendarItems([item("b", "2026-10-02"), item("a", "2026-10-01", "Z"), item("c", "2026-10-01", "A")]);
    expect(sorted.map((x) => x.key)).toEqual(["c", "a", "b"]);
    expect([...groupByDay(sorted).keys()]).toEqual(["2026-10-01", "2026-10-02"]);
  });
});
