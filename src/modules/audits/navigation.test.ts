import { describe, it, expect } from "vitest";
import { auditListingReturnTo, auditWithReturnTo } from "./navigation";
describe("Auditorías: contexto seguro de regreso",()=>{
  it("preserva búsqueda, filtros múltiples y paginación",()=>{
    const source="/audits?q=QA-FINAL&type=INTERNAL&type=EXTERNAL&page=2&status=CLOSED";
    expect(auditListingReturnTo(source)).toBe(source);
    const url=auditWithReturnTo("/audits/uuid?tab=findings#finding",source);
    const parsed=new URL(url,"https://audits.invalid");
    expect(parsed.searchParams.get("tab")).toBe("findings");
    expect(parsed.searchParams.get("returnTo")).toBe(source);
    expect(parsed.hash).toBe("#finding");
  });
  it.each(["https://example.org/evil","//example.org/evil","/audits/other","/audits?x=1#bad","/audits?x=1\\bad"])("rechaza destinos distintos del listado: %s",value=>{
    expect(auditListingReturnTo(value)).toBe("/audits");
  });
  it("no cambia rutas no relacionadas",()=>expect(auditWithReturnTo("/capa/other","/audits?page=2")).toBe("/capa/other"));
});
