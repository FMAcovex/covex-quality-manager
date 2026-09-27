import { describe,expect,it } from "vitest";
import { mapHistoricalChangeRows } from "@/modules/change-control/import/legacy-mapping";
describe("mapHistoricalChangeRows",()=>{
  it("normaliza 2026 y conserva seguimientos 00/01",()=>{
    const rows=mapHistoricalChangeRows([], [{rowNumber:5,cells:{B:"GC-00",C:"C/GC-00/001/2026",D:"Cambio prueba",E:"16/04/2026",F:"16/04/2026",G:"Mayor",H:"05/10/2026",I:"No ejecutado",K:"Pendiente",L:"00 09/06/2026\n01 10/07/2026",M:"08/09/2026",N:"Abierto"}}]);
    expect(rows).toHaveLength(1);expect(rows[0].classification).toBe("MAJOR");expect(rows[0].followups.map((x)=>x.sequence)).toEqual([0,1]);expect(rows[0].status).toBe("OPEN");
  });
});
