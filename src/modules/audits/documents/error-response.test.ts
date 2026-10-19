import { describe, expect, it } from "vitest";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { AuditEngineError } from "@/lib/audit/domain";
import { auditDocumentErrorResponse } from "./error-response";

describe("auditDocumentErrorResponse", () => {
  it("muestra la página de plantilla no disponible", async () => {
    expect(auditDocumentErrorResponse(new TemplateAssetError("Falta A4.03")).status).toBe(503);
  });
  it("la muestra también cuando el audit trail envuelve el error", async () => {
    const response = auditDocumentErrorResponse(new AuditEngineError("WRITE_FAILED", { cause: new TemplateAssetError("Falta A4.03") }));
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("Falta A4.03");
  });
  it("enseña el motivo de negocio envuelto por el audit trail", async () => {
    const response = auditDocumentErrorResponse(new AuditEngineError("WRITE_FAILED", { cause: new Error("Abre la auditoría antes de generar documentos operativos.") }));
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("Abre la auditoría antes de generar documentos operativos.");
  });
  it("no expone errores técnicos internos", async () => {
    class DatabaseError extends Error {}
    const response = auditDocumentErrorResponse(new AuditEngineError("WRITE_FAILED", { cause: new DatabaseError("constraint covex_x violated") }));
    expect(response.status).toBe(409);
    const body = await response.text();
    expect(body).not.toContain("constraint");
    expect(body).toContain("No se ha confirmado la operación de auditoría.");
  });
});
