import { describe,expect,it } from "vitest";
import { mapHistoricalCapaRows } from "@/modules/capa/import/legacy-mapping";
import type { XlsxRow } from "@/modules/deviations/import/xlsx-reader";
describe("CAPA historical mapping",()=>{
 it("maps 2025 and enriches efficacy from Base_KPI",()=>{
  const y25:XlsxRow={rowNumber:6,cells:{B:"Correctiva",C:"GC-00",D:"AC/GC-00/001/2025",E:"Garantía de Calidad",F:"Desviación",G:"D/GC-00/001/2025",H:"Acción",I:"07/01/2025",K:"15/01/2025",L:"16/01/2025",M:"Cerrada"}};
  const base:XlsxRow={rowNumber:6,cells:{E:"AC/GC-00/001/2025",H:"Desviación",P:"Conforme"}};
  const [r]=mapHistoricalCapaRows([y25],[],[base]);
  expect(r.effectivenessStatus).toBe("CONFORMING");
  expect(r.businessCode).toBe("AC/GC-00/001/2025");
 });
 it("maps explicit 2026 follow-up and next date",()=>{
  const y26:XlsxRow={rowNumber:5,cells:{A:"Preventiva",B:"GC-00",C:"AP/GC-00/001/2026",D:"Auditoría interna",F:"Acción",G:"01/02/2026",I:"Abierta",K:"Pendiente",L:"00 01/02/2026 01 15/02/2026",M:"01/03/2026"}};
  const [r]=mapHistoricalCapaRows([], [y26], []);
  expect(r.followupSequence).toBe(1);
  expect(r.followupDate?.toISOString().slice(0,10)).toBe("2026-02-15");
  expect(r.nextFollowupDate?.toISOString().slice(0,10)).toBe("2026-03-01");
 });
});
