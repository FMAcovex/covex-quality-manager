import { describe, it, expect } from "vitest";
import { resolutionSchema, validateCandidate, indexMetadata } from "./domain";
import { parseIndex } from "../preview/analysis";
import { previewFixture } from "../preview/synthetic-workbook";
import { validateDepartmentForBaseCode } from "../domain";
const resolution = { title: "Procedimiento ficticio", revisionCode: "00", effectiveFrom: "", reviewDueAt: "", declaredState: "IN_FORCE" as const, departmentId: "12345678-1234-4234-8234-123456789abc", reviewed: true as const, reason: "Contraste manual; fechas no documentadas" };
describe("P1B-2 frontera de conciliación", () => {
    it("conserva 00 y fechas vacías sin inventar evidencias", () => { expect(resolutionSchema.parse(resolution)).toEqual(resolution); expect(resolutionSchema.parse({...resolution,revisionCode:""}).revisionCode).toBe(""); });
    it("rechaza fechas imposibles, orden contradictorio y revisión no explícita", () => { for (const change of [{effectiveFrom:"2026-02-30"},{effectiveFrom:"2026-04-01",reviewDueAt:"2026-03-01"},{revisionCode:"0"}]) expect(resolutionSchema.safeParse({...resolution,...change}).success).toBe(false); });
    it("exige decisión identificada, explicación y correspondencia UUID", () => { for (const change of [{reviewed:false},{reason:""},{departmentId:"GC-00"}]) expect(resolutionSchema.safeParse({...resolution,...change}).success).toBe(false); });
    it.each([["MC-20", true], ["GC-00", false], ["MC-10", false]])("reutiliza la familia departamental completa P1A para %s", (department, allowed) => {
        const validate = () => validateDepartmentForBaseCode("MC-20/001", String(department));
        if (allowed) expect(validate).not.toThrow();
        else expect(validate).toThrow("El código base no corresponde al departamento responsable.");
    });
    it("no admite GC-00 ni otras familias aunque la resolución sea completa", () => { const report = parseIndex(previewFixture(),"synthetic.xlsx"); expect(report.rows.some(r => r.source.sheet === "GC-00")).toBe(false); const row = report.rows.find(r => r.normalized.baseCode === "GC-00/001")!; expect(() => validateCandidate(row,resolution)).not.toThrow(); expect(() => validateCandidate({...row,source:{...row.source,sheet:"GC-00"}},resolution)).toThrow(); expect(() => validateCandidate({...row,source:{...row.source,sheet:"MC-20"},normalized:{...row.normalized,departmentCode:"MC-20"}},resolution)).toThrow(); expect(() => validateCandidate(report.rows.find(r => r.classification === "OTHER")!,resolution)).toThrow(); });
    it("solo reconoce metadatos de índice independientes del estado documental", () => { expect(indexMetadata(null)).toBe(null); expect(indexMetadata({indexImport:{declaredState:"VERIFIED"}})).toBe(null); expect(indexMetadata({indexImport:{batchId:"lote",sheet:"GC-00(",row:9,declaredState:"IN_FORCE"}})?.declaredState).toBe("IN_FORCE"); });
});
