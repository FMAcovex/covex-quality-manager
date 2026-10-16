import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const at = (iso: string) => new Date(iso);
vi.mock("@/lib/db", () => ({
  prisma: {
    changeHistory: { findMany: vi.fn(async () => [{ id: "h1", changedAt: at("2026-10-03T10:00:00Z"), changedByText: "Ana", fieldPath: "status", reason: "Cierre", source: "UI" }]) },
    qmsRecordVersion: { findMany: vi.fn(async () => [{ id: "v1", createdAt: at("2026-10-01T09:00:00Z"), createdByText: "Ana", sequenceNumber: 0, kind: "INITIAL", reason: null, frozenAt: at("2026-10-02T00:00:00Z") }]) },
    generatedDocument: { findMany: vi.fn(async () => [{ id: "d1", generatedAt: at("2026-10-04T08:00:00Z"), generatedByText: "Luis", documentType: "DEVIATION_ANNEX_III", fileName: "anexo.docx", recordVersion: { sequenceNumber: 1 } }]) },
    recordVersionDocument: { findMany: vi.fn(async () => [{ id: "s1", uploadedAt: at("2026-10-05T08:00:00Z"), uploadedByText: null, kind: "SIGNED_PDF", fileName: "firmado.pdf", recordVersion: { sequenceNumber: 1 } }]) },
    qmsRelation: { findMany: vi.fn(async () => [{ id: "r1", createdAt: at("2026-10-02T12:00:00Z"), createdByText: "Ana", isActive: false, sourceRecordId: "rec", sourceRecord: { recordType: "DEVIATION", businessCode: "DV-1", annulledBusinessCode: null }, targetRecord: { recordType: "CAPA", businessCode: "AC-7", annulledBusinessCode: null } }]) },
  },
}));

describe("Cronología del expediente", () => {
  it("combina todas las fuentes de la más reciente a la más antigua", async () => {
    const { getRecordTimeline } = await import("@/lib/qms/timeline");
    const entries = await getRecordTimeline("rec");
    expect(entries.map((entry) => entry.id)).toEqual(["signed:s1", "document:d1", "change:h1", "relation:r1", "version:v1"]);
    expect(entries.map((entry) => entry.title)).toEqual([
      "PDF firmado · V01",
      "Anexo III · V01",
      "status",
      "CAPA AC-7",
      "V00 · Versión inicial",
    ]);
    expect(entries.find((entry) => entry.kind === "CHANGE")?.detail).toBe("Motivo: Cierre");
    expect(entries.find((entry) => entry.kind === "VERSION")?.detail).toBe("Versión congelada");
    expect(entries.find((entry) => entry.kind === "RELATION")?.detail).toMatch(/retirada/);
  });

  it("nombra los tipos de documento sin depender de cada módulo", async () => {
    const { documentTypeLabel } = await import("@/lib/qms/timeline");
    expect(documentTypeLabel("CHANGE_ANNEX_VII")).toBe("Anexo VII");
    expect(documentTypeLabel("CAPA_SIMPLE_LIST")).toBe("Listado simple");
    expect(documentTypeLabel("AUDIT_INTERNAL_REPORT")).toBe("Informe de auditoría interna");
    const { DocumentType } = await import("@prisma/client");
    for (const type of Object.values(DocumentType)) expect(documentTypeLabel(type)).not.toBe(type);
  });

  it("traduce los marcadores técnicos del historial y conserva el resto", async () => {
    const { historyFieldLabel } = await import("@/lib/qms/timeline");
    expect(historyFieldLabel("__created__")).toBe("Alta del expediente");
    expect(historyFieldLabel("rootCause")).toBe("rootCause");
  });
});
