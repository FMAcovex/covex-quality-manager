import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { findUnique, requestHeaders } = vi.hoisted(() => ({ findUnique: vi.fn(), requestHeaders: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { controlledDocument: { findUnique } } }));
vi.mock("next/headers", () => ({ headers: requestHeaders }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("Not found"); } }));
vi.mock("@/modules/controlled-documents/components/document-link", () => ({ DocumentLink: ({ children, href }: { children: React.ReactNode; href: string }) => React.createElement("a", { href }, children) }));
vi.mock("@/modules/controlled-documents/components/revision-documents", () => ({ RevisionDocuments: () => null }));
import DetailPage from "@/app/controlled-documents/[id]/page";
import { documentHistoryActions } from "./history";

const secret = "synthetic-test-key-not-a-real-secret";
const events = [
  { id: "ordinary-p1a", action: "Edición de maestro", changedByText: "Responsable P1A", reason: "Motivo ordinario P1A", oldValue: {}, newValue: { title: "Título P1A" } },
  { id: "ordinary-p1b", action: "Importación del índice", changedByText: "Responsable P1B", reason: "Motivo ordinario P1B", oldValue: {}, newValue: { sourceReference: "Fuente ordinaria P1B" } },
  { id: "incorporation", action: documentHistoryActions.incorporation, changedByText: "Responsable documental privado", reason: "Motivo de incorporación privado", oldValue: {}, newValue: { documentObjectId: "uuid-privado", originalName: "archivo-privado.pdf", sha256: "hash-privado" } },
  { id: "replacement", action: documentHistoryActions.replacement, changedByText: "Sustituidor documental privado", reason: "Motivo de sustitución privado", oldValue: { documentObjectId: "uuid-privado" }, newValue: { documentObjectId: "uuid-sustituto", originalName: "sustituto-privado.pdf" } },
].map(e => ({ ...e, changedAt: new Date("2026-10-09T00:00:00Z") }));

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubEnv("PNT_DOCUMENT_ACCESS_MODE", "trusted-proxy"); vi.stubEnv("PNT_DOCUMENT_PROXY_SECRET", secret);
  findUnique.mockImplementation(async ({ include }) => {
    const excluded: string[] = include.changes.where.action?.notIn || [];
    return { id: "master", baseCode: "GC-00/900", title: "PNT sintético", administrativeStatus: "DRAFT", sourceMetadata: null, revisions: [], changes: events.filter(e => !excluded.includes(e.action)) };
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
async function history() {
  return renderToStaticMarkup(await DetailPage({ params: Promise.resolve({ id: "master" }), searchParams: Promise.resolve({ tab: "history" }) }));
}
describe("P2A permiso de lectura del historial documental", () => {
  it.each([new Headers(), new Headers({ "x-pnt-user": "Suplantado", "x-pnt-permissions": "read", "x-pnt-proxy-secret": "incorrecto" }), new Headers({ "x-pnt-user": "Sin lectura", "x-pnt-permissions": "write", "x-pnt-proxy-secret": secret })])("sin acceso no consulta ni presenta eventos documentales; conserva P1A/P1B", async h => {
    requestHeaders.mockResolvedValue(h);
    const html = await history();
    expect(findUnique.mock.calls[0][0].include.changes.where).toEqual({ action: { notIn: Object.values(documentHistoryActions) } });
    expect((await findUnique.mock.results[0].value).changes).toEqual(events.slice(0, 2));
    for (const text of ["Responsable P1A", "Motivo ordinario P1A", "Título P1A", "Responsable P1B", "Motivo ordinario P1B", "Fuente ordinaria P1B"]) expect(html).toContain(text);
    for (const text of [documentHistoryActions.incorporation, documentHistoryActions.replacement, "Responsable documental privado", "Sustituidor documental privado", "Motivo de incorporación privado", "Motivo de sustitución privado", "uuid-privado", "uuid-sustituto", "archivo-privado.pdf", "hash-privado"]) expect(html).not.toContain(text);
  });
  it("con permiso read (sin write) conserva todos los eventos y sus datos sin redacción", async () => {
    requestHeaders.mockResolvedValue(new Headers({ "x-pnt-user": "Lector autenticado", "x-pnt-permissions": "read", "x-pnt-proxy-secret": secret }));
    const html = await history();
    expect(findUnique.mock.calls[0][0].include.changes.where).toEqual({});
    expect((await findUnique.mock.results[0].value).changes).toEqual(events);
    for (const text of ["Responsable P1A", "Responsable P1B", documentHistoryActions.incorporation, documentHistoryActions.replacement, "Responsable documental privado", "Sustituidor documental privado", "Motivo de incorporación privado", "Motivo de sustitución privado"]) expect(html).toContain(text);
  });
});
