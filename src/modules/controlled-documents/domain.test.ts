import { describe, it, expect } from "vitest";
import { validBaseCode, validRevisionCode, validDate, normalizeBaseCode, parseMasterForm, validateDepartmentForBaseCode, validateExistingRevision, validateRevisionDates, displayDate } from "./domain";
import { listWhere } from "./queries";
describe("PNT P1A: identidad y evidencia documental", () => {
    it.each([["MC-20", true], ["GC-00", false], ["MC-10", false]])("comprueba la familia completa del PNT para el departamento %s", (department, allowed) => {
        const validate = () => validateDepartmentForBaseCode("MC-20/001", String(department));
        if (allowed) expect(validate).not.toThrow();
        else expect(validate).toThrow("El código base no corresponde al departamento responsable.");
    });
    it("distingue maestro y revisión original sin código anual", () => {
        expect(normalizeBaseCode(" gc-00/001 ")).toBe("GC-00/001");
        expect(validBaseCode("GC-00/001")).toBe(true);
        for (const v of ["GC-00/001/03", "2026/001", "GC-00/1", "GC-IT_01/001"])
            expect(validBaseCode(v)).toBe(false);
        expect(validRevisionCode("00")).toBe(true);
        expect(validRevisionCode("3")).toBe(false);
    });
    it("acepta borrador incompleto pero exige responsable", () => { const fd = new FormData(); fd.set("operation", "DRAFT"); fd.set("actor", "Usuario ficticio"); expect(parseMasterForm(fd).revisionCode).toBe(""); expect(parseMasterForm(fd).baseCode).toBe(""); fd.delete("actor"); expect(() => parseMasterForm(fd)).toThrow(); });
    it("rechaza aprobación ficticia y vigencia futura", () => { const v = { existingDocument: true, verified: true, sourceReference: "Fuente", existingStatus: "IN_FORCE" as const, effectiveFrom: "2026-04-13", obsoletedAt: "" }; expect(() => validateExistingRevision(v, "2026-10-08")).not.toThrow(); expect(() => validateExistingRevision({ ...v, verified: false })).toThrow(); expect(() => validateExistingRevision({ ...v, effectiveFrom: "2030-01-01" }, "2026-10-08")).toThrow(); expect(() => validateExistingRevision({ ...v, obsoletedAt: "2026-10-01" })).toThrow(); });
    it("no descarta fechas cuando falta la revisión explícita",()=>{
        const fd=new FormData();fd.set("actor","Usuario ficticio");fd.set("operation","DRAFT");fd.set("reviewDueAt","2031-01-01");
        expect(()=>parseMasterForm(fd)).toThrow("revisión explícita");
        fd.set("revisionCode","00");expect(parseMasterForm(fd).reviewDueAt).toBe("2031-01-01");
    });
    it("no permite registrar aprobaciones por manipulación del formulario", () => {
        const fd = new FormData();
        fd.set("actor", "Usuario ficticio");
        fd.set("operation", "DRAFT");
        fd.set("existingStatus", "APPROVED_PENDING_EFFECTIVE");
        expect(() => parseMasterForm(fd)).toThrow();
        fd.set("existingStatus", "OBSOLETE");
        fd.set("revisionCode", "03");
        expect(parseMasterForm(fd).revisionCode).toBe("03");
    });
    it("fechas reales y presentación estable", () => { expect(validDate("2026-02-30")).toBe(false); expect(validDate("2024-02-29")).toBe(true); expect(displayDate("2026-04-13")).toBe("13/04/2026"); expect(() => validateRevisionDates({ effectiveFrom: "2026-04-13", reviewDueAt: "2025-01-01", obsoletedAt: "" })).toThrow(); });
    it("combina revisión y vigencia en una misma revisión SQL", () => { const where = listWhere({ q: "  GC-00  ", revision: "00", revisionState: "IN_FORCE", validity: "due", state: "ACTIVE", department: "dep" }); expect(where.AND).toHaveLength(4); expect(JSON.stringify(where)).toContain('"revisionCode":"00"'); expect(JSON.stringify(where)).toContain('"reviewDueAt"'); expect(JSON.stringify(listWhere({ revisionState: "__proto__" }))).not.toContain("__proto__"); });
});
