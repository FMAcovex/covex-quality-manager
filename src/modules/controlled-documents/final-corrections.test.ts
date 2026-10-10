import { describe, expect, it } from "vitest";
import { listingQuery, listingReturnTo, withReturnTo } from "./navigation";
import { canEditRevision } from "./revision-editability";
import { documentStateLabel, revisionProvenance } from "./presentation";
const context = "/controlled-documents?q=QA&quick=unverified&state=ACTIVE&sort=title&direction=desc&view=latest&page=2";
const draft = { status: "DRAFT", consolidatedAt: null, decisions: [] };
const decision = (oldState = "DRAFT", newState = "IN_REVIEW") => ({ id: "d", operation: "MANUAL_STATUS", oldState, newState, result: null, details: {} });
describe("PNT regresión de editabilidad", () => {
  it("permite Borrador → En revisión → Borrador manteniendo sus decisiones", () => {
    expect(canEditRevision({ ...draft, lifecycle: { legacyOrigin: false, approvalAt: null }, decisions: [decision(), decision("IN_REVIEW", "DRAFT")] })).toBe(true);
  });
  it.each(["IN_REVIEW", "APPROVED_PENDING_EFFECTIVE", "IN_FORCE", "OBSOLETE", "ANNULLED", "IMPORTED_PENDING"])("bloquea %s", status => expect(canEditRevision({ ...draft, status })).toBe(false));
  it("bloquea una aprobación anterior aunque vuelva a borrador sin marca de consolidación", () => expect(canEditRevision({ ...draft, decisions: [decision("APPROVED_PENDING_EFFECTIVE", "DRAFT")] })).toBe(false));
  it("bloquea consolidado, histórico y aprobación con fecha", () => {
    expect(canEditRevision({ ...draft, consolidatedAt: new Date() })).toBe(false);
    expect(canEditRevision({ ...draft, lifecycle: { legacyOrigin: true, approvalAt: null } })).toBe(false);
    expect(canEditRevision({ ...draft, lifecycle: { legacyOrigin: false, approvalAt: new Date() } })).toBe(false);
  });
  it("bloquea aprobación externa aceptada incluso antes de planificar", () => expect(canEditRevision({ ...draft, decisions: [
    { ...decision(), id: "approval", operation: "REGISTER_EXTERNAL", details: { function: "APPROVAL" } },
    { ...decision(), operation: "CONTRAST_EXTERNAL", result: "ACCEPTED", details: { registrationId: "approval" } },
  ] })).toBe(false));
});
describe("PNT contexto de navegación", () => {
  it("conserva toda la consulta incluida página al abrir una ficha o editar", () => {
    const query = listingQuery(Object.fromEntries(new URL(context, "https://qa.invalid").searchParams));
    expect("/controlled-documents?" + query).toBe(context);
    expect(new URL(withReturnTo("/controlled-documents/id?tab=revisions", context), "https://qa.invalid").searchParams.get("returnTo")).toBe(context);
  });
  it("reinicia página solo al aplicar filtros expresamente", () => {
    const filters = { q: "QA", view: "latest", sort: "title", page: "2" };
    expect(listingQuery(filters, { q: "otro" }, true)).toBe("q=otro&view=latest&sort=title");
    expect(listingQuery(filters, { page: "3" }, true)).toContain("page=3");
  });
  it.each(["https://example.invalid", "//example.invalid/controlled-documents", "/controlled-documents/otro?q=x", "/controlled-documents?x=1#fuera", "/controlled-documents?x=\\evil", null])("rechaza destino ajeno %s", value => expect(listingReturnTo(value)).toBe("/controlled-documents"));
});
describe("PNT presentación", () => {
  it("separa etiquetas documentales de las administrativas", () => {
    expect(documentStateLabel("DRAFT")).toBe("Borrador");
    expect(documentStateLabel("IN_FORCE")).toBe("Vigente");
    expect(documentStateLabel("APPROVED_PENDING_EFFECTIVE")).toBe("Aprobado");
  });
  it("un ciclo documental manual no acredita importación", () => expect(revisionProvenance({ sourceMetadata: null, consolidatedAt: null, verificationStatus: "UNVERIFIED" })).toContain("creada manualmente"));
  it("distingue importación pendiente y contrastada por metadatos reales", () => {
    const sourceMetadata = { indexImport: { batchId: "qa", declaredState: "IN_FORCE", sheet: "GC-00(", row: 2 } };
    expect(revisionProvenance({ sourceMetadata, consolidatedAt: null, verificationStatus: "UNVERIFIED" })).toContain("importada pendiente");
    expect(revisionProvenance({ sourceMetadata, consolidatedAt: null, verificationStatus: "VERIFIED" })).toContain("contraste documental registrado");
  });
  it("identifica consolidación sin inferir importación", () => expect(revisionProvenance({ sourceMetadata: null, consolidatedAt: new Date(), verificationStatus: "VERIFIED" })).toBe("Revisión consolidada: contenido de solo lectura."));
});
