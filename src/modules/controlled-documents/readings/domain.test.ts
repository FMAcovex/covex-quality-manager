import { describe, expect, it } from "vitest";
import {
  canAssignReadings, effectiveReadingState, externalReaderKey, parseAddReadersForm, parseConfirmReadingForm, parsePreviousReadersForm, parseRereadForm, parseWithdrawReadingForm,
  parseBulkAddReadersForm, readingDueDate, readingCounts, readingSummary, readingSaved,
} from "./domain";

// D-141: lecturas de PNT. Control operativo de por dónde va la lectura de cada revisión.
const form = (entries: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) for (const item of [value].flat()) fd.append(key, item);
  return fd;
};
const USER_A = "11111111-1111-4111-8111-111111111111", USER_B = "22222222-2222-4222-8222-222222222222", REV = "33333333-3333-4333-8333-333333333333";

describe("revisiones que se pueden leer", () => {
  it("la vigente y la aprobada pendiente de vigencia; ninguna otra", () => {
    expect(canAssignReadings("IN_FORCE")).toBe(true);
    expect(canAssignReadings("APPROVED_PENDING_EFFECTIVE")).toBe(true);
    for (const status of ["DRAFT", "IN_REVIEW", "PENDING_APPROVAL", "OBSOLETE", "ANNULLED", "IMPORTED_PENDING"] as const) expect(canAssignReadings(status)).toBe(false);
  });
});

describe("plazo", () => {
  it("15 días naturales por defecto, también al cambiar de mes y de año", () => {
    expect(readingDueDate("2026-11-26")).toBe("2026-12-11");
    expect(readingDueDate("2026-12-20")).toBe("2027-01-04");
    expect(readingDueDate("2026-11-26", 3)).toBe("2026-11-29");
  });
});

describe("estado efectivo", () => {
  it("una lectura pendiente de una revisión que ya no se lee (sustituida) deja de estar pendiente", () => {
    expect(effectiveReadingState({ status: "PENDING", revisionStatus: "IN_FORCE" })).toBe("PENDING");
    expect(effectiveReadingState({ status: "PENDING", revisionStatus: "OBSOLETE" })).toBe("SUPERSEDED");
    expect(effectiveReadingState({ status: "READ", revisionStatus: "OBSOLETE" })).toBe("READ");
    expect(effectiveReadingState({ status: "WITHDRAWN", revisionStatus: "IN_FORCE" })).toBe("WITHDRAWN");
  });
});

describe("contador y resumen", () => {
  const rows = [
    { readerUserId: USER_A, readerName: "Ana", status: "READ" as const, revisionStatus: "OBSOLETE" as const, dueDate: "2026-01-01" },
    { readerUserId: USER_A, readerName: "Ana", status: "READ" as const, revisionStatus: "IN_FORCE" as const, dueDate: "2026-11-01" },
    { readerUserId: USER_A, readerName: "Ana", status: "PENDING" as const, revisionStatus: "IN_FORCE" as const, dueDate: "2026-12-01" },
    { readerUserId: null, readerName: " Pedro  Gómez ", status: "READ" as const, revisionStatus: "IN_FORCE" as const, dueDate: "2026-11-01" },
    { readerUserId: USER_B, readerName: "Bea", status: "PENDING" as const, revisionStatus: "IN_FORCE" as const, dueDate: "2026-11-20" },
    { readerUserId: USER_B, readerName: "Bea", status: "WITHDRAWN" as const, revisionStatus: "IN_FORCE" as const, dueDate: "2026-11-20" },
  ];
  it("cuenta las lecturas confirmadas de cada persona en el PNT, en todas sus revisiones", () => {
    const counts = readingCounts(rows);
    expect(counts.get(`user:${USER_A}`)).toBe(2);
    expect(counts.get(externalReaderKey("pedro gómez"))).toBe(1);
    expect(counts.get(`user:${USER_B}`) ?? 0).toBe(0);
  });
  it("resume pendientes y vencidas con el día de hoy", () => {
    expect(readingSummary(rows, "2026-11-26")).toEqual({ pending: 2, overdue: 1, read: 3 });
  });
});

describe("formularios", () => {
  it("añadir: usuarios, departamentos y personas externas (una por línea), con plazo", () => {
    const value = parseAddReadersForm(form({ revisionId: REV, userIds: [USER_A, USER_B, USER_A], departmentIds: ["dep-1"], externalNames: "Pedro Gómez\n\n  Luis  \npedro gómez", dueDate: "2026-12-11" }), "2026-11-26");
    expect(value).toEqual({ revisionId: REV, userIds: [USER_A, USER_B], departmentIds: ["dep-1"], externalNames: ["Pedro Gómez", "Luis"], dueDate: "2026-12-11" });
  });
  it("añadir: exige alguien y un plazo no anterior a hoy", () => {
    expect(() => parseAddReadersForm(form({ revisionId: REV, dueDate: "2026-12-11" }), "2026-11-26")).toThrow(/al menos una persona/);
    expect(() => parseAddReadersForm(form({ revisionId: REV, userIds: USER_A, dueDate: "2026-11-25" }), "2026-11-26")).toThrow(/plazo/);
    expect(() => parseAddReadersForm(form({ revisionId: REV, userIds: USER_A, dueDate: "2026-02-31" }), "2026-11-26")).toThrow(/plazo/);
    expect(() => parseAddReadersForm(form({ revisionId: "x", userIds: USER_A, dueDate: "2026-12-11" }), "2026-11-26")).toThrow();
  });
  it("marcar como leído: fecha de lectura no futura", () => {
    expect(parseConfirmReadingForm(form({ readingId: REV, readOn: "2026-11-26" }), "2026-11-26")).toEqual({ readingId: REV, readOn: "2026-11-26" });
    expect(() => parseConfirmReadingForm(form({ readingId: REV, readOn: "2026-11-27" }), "2026-11-26")).toThrow(/futura/);
  });
  it("lectores anteriores: revisión y plazo", () => {
    expect(parsePreviousReadersForm(form({ revisionId: REV, dueDate: "2026-12-11" }), "2026-11-26")).toEqual({ revisionId: REV, dueDate: "2026-12-11" });
    expect(() => parsePreviousReadersForm(form({ revisionId: REV, dueDate: "" }), "2026-11-26")).toThrow(/plazo/);
  });
  it("relectura con plazo y retirada con motivo", () => {
    expect(parseRereadForm(form({ readingId: REV, dueDate: "2026-12-11" }), "2026-11-26")).toEqual({ readingId: REV, dueDate: "2026-12-11" });
    expect(parseWithdrawReadingForm(form({ readingId: REV, reason: " Ya no trabaja en el área " }))).toEqual({ readingId: REV, reason: "Ya no trabaja en el área" });
    expect(() => parseWithdrawReadingForm(form({ readingId: REV, reason: " " }))).toThrow(/motivo/);
  });
});

describe("formulario tras guardar (revisión independiente, I-1)", () => {
  it("cada guardado correcto da una revisión nueva del formulario, para que repetir los mismos datos sea una petición nueva", () => {
    const first = readingSaved({ error: null }, "Lectura pedida a 1 persona.");
    expect(first).toEqual({ error: null, message: "Lectura pedida a 1 persona.", formRevision: 1 });
    const second = readingSaved({ ...first, error: "Error anterior" }, "Lectura pedida a 1 persona.");
    expect(second.formRevision).toBe(2);
    expect(second.error).toBeNull();
  });
});

describe("límites de una petición (revisión independiente, M-2)", () => {
  it("rechaza más de 100 personas externas de una vez", () => {
    const names = Array.from({ length: 101 }, (_, n) => `Persona ${n}`).join("\n");
    expect(() => parseAddReadersForm(form({ revisionId: "7f9c1c3e-8a59-4ef7-9a0e-3a5b8b1e2f10", externalNames: names, dueDate: "2026-12-11" }), "2026-11-26")).toThrow(/como máximo 100/);
  });
});

describe("asignación masiva (D-141, entrega 2)", () => {
  const ids = ["7f9c1c3e-8a59-4ef7-9a0e-3a5b8b1e2f10", "8a9c1c3e-8a59-4ef7-9a0e-3a5b8b1e2f11"];
  const user = "9b9c1c3e-8a59-4ef7-9a0e-3a5b8b1e2f12";
  it("lee varios PNT, la revisión elegida (vigente por defecto) y los mismos lectores que el formulario de un PNT", () => {
    expect(parseBulkAddReadersForm(form({ documentIds: [...ids, ids[0]], userIds: user, externalNames: "Ana\nana", dueDate: "2026-12-11" }), "2026-11-26"))
      .toEqual({ documentIds: ids, revisionStatus: "IN_FORCE", userIds: [user], departmentIds: [], externalNames: ["Ana"], dueDate: "2026-12-11" });
    expect(parseBulkAddReadersForm(form({ documentIds: ids[0], revisionStatus: "APPROVED_PENDING_EFFECTIVE", externalNames: "Ana", dueDate: "2026-11-26" }), "2026-11-26").revisionStatus).toBe("APPROVED_PENDING_EFFECTIVE");
  });
  it("exige al menos un PNT y un lector, una revisión que se lee y un plazo no anterior a hoy", () => {
    expect(() => parseBulkAddReadersForm(form({ userIds: user, dueDate: "2026-12-11" }), "2026-11-26")).toThrow(/al menos un PNT/);
    expect(() => parseBulkAddReadersForm(form({ documentIds: ids[0], dueDate: "2026-12-11" }), "2026-11-26")).toThrow(/al menos una persona/);
    expect(() => parseBulkAddReadersForm(form({ documentIds: ids[0], revisionStatus: "DRAFT", userIds: user, dueDate: "2026-12-11" }), "2026-11-26")).toThrow(/revisión/);
    expect(() => parseBulkAddReadersForm(form({ documentIds: ids[0], userIds: user, dueDate: "2026-11-25" }), "2026-11-26")).toThrow(/plazo/);
    expect(() => parseBulkAddReadersForm(form({ documentIds: Array.from({ length: 201 }, () => crypto.randomUUID()), userIds: user, dueDate: "2026-12-11" }), "2026-11-26")).toThrow(/200/);
  });
});
