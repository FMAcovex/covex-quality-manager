import { describe, expect, it } from "vitest";
import { auditDocumentBlocker } from "./availability";

describe("auditDocumentBlocker", () => {
  it("permite el CAPA Plan del estado actual en borrador", () => {
    expect(auditDocumentBlocker({ status: "DRAFT", type: "AUDIT_CAPA_PLAN", sequence: null })).toBeNull();
  });
  it("mantiene el bloqueo del borrador para el resto de documentos", () => {
    expect(auditDocumentBlocker({ status: "DRAFT", type: "AUDIT_EXTERNAL_PLAN", sequence: null })).toBe("Abre la auditoría antes de generar documentos operativos.");
  });
  it("exige una versión formal para el informe", () => {
    expect(auditDocumentBlocker({ status: "OPEN", type: "AUDIT_INTERNAL_REPORT", sequence: null })).toBe("El informe se genera desde una versión formal concreta.");
    expect(auditDocumentBlocker({ status: "OPEN", type: "AUDIT_INTERNAL_REPORT", sequence: 0 })).toBeNull();
  });
});
