import { describe, expect, it } from "vitest";
import { qmsListPagination } from "./list-pagination";

describe("páginas SQL de expedientes", () => {
  it.each([undefined, "", "0", "-1", "1.5", "NaN", "Infinity", "9007199254740992"])("normaliza %s sin offsets inválidos", value => {
    expect(qmsListPagination(1000, value).page).toBe(1);
  });
  it("limita páginas fuera de rango y mantiene el total incluso sin coincidencias", () => {
    expect(qmsListPagination(1001, "999")).toEqual({ total: 1001, page: 41, pageCount: 41, pageSize: 25 });
    expect(qmsListPagination(0, "4")).toEqual({ total: 0, page: 1, pageCount: 1, pageSize: 25 });
  });
});
