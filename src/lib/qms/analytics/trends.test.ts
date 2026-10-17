import { describe, expect, it } from "vitest";
import {
  buildAging,
  buildMonthlyCounts,
  countLabels,
  daysFromTo,
  inYearToDate,
  indicatorsHref,
  isDue,
  paretoDimension,
  yearToDateWindow,
} from "@/lib/qms/analytics/trends";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("tendencias compartidas de indicadores", () => {
  it("cuenta por mes las fechas recibidas e ignora las vacías", () => {
    const series = buildMonthlyCounts([d("2026-10-01"), null, d("2026-10-05"), d("2026-09-30")], 2026, new Set([2024, 2025, 2026]), d("2026-10-17"));
    expect(series.at(-1)).toMatchObject({ year: 2026, month: 9, count: 2, partial: true, rolling12: null });
    expect(series.at(-2)).toMatchObject({ year: 2026, month: 8, count: 1, rolling12: 0.1 });
  });

  it("acota el acumulado al mismo día de corte, también en años bisiestos", () => {
    const window = yearToDateWindow(2028, d("2028-02-29"));
    expect(window).toEqual({ cutoffMonth: 1, cutoffDay: 29, fullYear: false });
    expect(inYearToDate(window, 2027, d("2027-02-28"))).toBe(true);
    expect(inYearToDate(window, 2027, d("2027-03-01"))).toBe(false);
    expect(inYearToDate(window, 2028, new Date("2028-02-29T23:59:00Z"))).toBe(true);
    expect(inYearToDate(window, 2028, null)).toBe(false);
  });

  it("cuenta etiquetas múltiples sobre el total de menciones", () => {
    expect(countLabels(["Equipos", "Proceso", "Equipos", "Documentación"])).toEqual([
      { label: "Equipos", count: 2, percentage: 50 },
      { label: "Documentación", count: 1, percentage: 25 },
      { label: "Proceso", count: 1, percentage: 25 },
    ]);
  });

  it("cuenta marcas por tramo de antigüedad y conserva la nota de las más antiguas", () => {
    const aging = buildAging([
      { id: "a", code: "C-1", startDate: d("2026-10-01"), tags: ["OVERDUE"] },
      { id: "b", code: "C-2", startDate: d("2026-05-01"), tags: ["OVERDUE", "MAJOR"], note: "Mayor" },
      { id: "c", code: "C-3", startDate: null, tags: ["OVERDUE"] },
    ], d("2026-10-17"));
    expect(aging.buckets.map((bucket) => [bucket.key, bucket.count, bucket.tags])).toEqual([
      ["0-30", 1, { OVERDUE: 1 }], ["31-60", 0, {}], ["61-90", 0, {}], ["90+", 1, { OVERDUE: 1, MAJOR: 1 }],
    ]);
    expect(aging.withoutStartDate).toBe(1);
    expect(aging.oldest[0]).toEqual({ id: "b", code: "C-2", ageDays: 169, note: "Mayor" });
  });

  it("compara vencimientos por día, con o sin el día de hoy", () => {
    const today = new Date("2026-10-17T18:00:00Z");
    expect(isDue(d("2026-10-17"), today)).toBe(true);
    expect(isDue(d("2026-10-17"), today, false)).toBe(false);
    expect(isDue(d("2026-10-16"), today, false)).toBe(true);
    expect(isDue(null, today)).toBe(false);
    expect(daysFromTo(d("2026-10-10"), d("2026-10-01"))).toBeNull();
  });

  it("valida la dimensión del Pareto y conserva los filtros en el enlace", () => {
    expect(paretoDimension("origin", ["area", "origin"] as const, "area")).toBe("origin");
    expect(paretoDimension("x", ["area", "origin"] as const, "area")).toBe("area");
    expect(indicatorsHref("/capa/indicators", { year: "2026", type: undefined, department: "d1" }, "origin", "area"))
      .toBe("/capa/indicators?year=2026&department=d1&pareto=origin#pareto");
    expect(indicatorsHref("/capa/indicators", {}, "area", "area")).toBe("/capa/indicators#pareto");
  });
});
