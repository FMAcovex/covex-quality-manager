import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { read, requestHeaders } = vi.hoisted(() => ({ read: vi.fn(), requestHeaders: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { controlledDocument: { findUniqueOrThrow: read } } }));
vi.mock("next/headers", () => ({ headers: requestHeaders }));
vi.mock("../components/lifecycle-form", () => ({ LifecycleForm: () => null }));
import { RevisionLifecycle } from "../components/revision-lifecycle";
const secret = "synthetic-test-key-not-a-real-secret";
beforeEach(() => {
  vi.stubGlobal("React", React); vi.stubEnv("PNT_DOCUMENT_ACCESS_MODE", "trusted-proxy"); vi.stubEnv("PNT_DOCUMENT_PROXY_SECRET", secret);
  read.mockResolvedValue({ administrativeStatus: "DRAFT", revisions: [{ id: "revision", revisionCode: "00", status: "IMPORTED_PENDING", sourceMetadata: null, documents: [], decisions: [{ id: "decision", sequence: 1, operation: "VERIFY", result: "DISCREPANCY", actor: "Actor documental privado", reason: "Motivo confidencial", oldState: "IMPORTED_PENDING", newState: "IMPORTED_PENDING", details: { notes: "Metadatos privados" }, evidence: [{ snapshot: { sha256: "sha-privado" } }] }] }] });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("P2B frontera de lectura", () => {
  it("sin read no consulta ni expone decisiones/metadatos", async () => {
    requestHeaders.mockResolvedValue(new Headers()); const html = renderToStaticMarkup(await RevisionLifecycle({ documentId: "master" }));
    expect(read).not.toHaveBeenCalled(); expect(html).toContain("no autorizado"); expect(html).not.toContain("Actor documental privado");
  });
  it("read sin write consulta íntegramente decisiones/evidencias históricas", async () => {
    requestHeaders.mockResolvedValue(new Headers({ "x-pnt-proxy-secret": secret, "x-pnt-user": "Lector", "x-pnt-permissions": "read" }));
    const html = renderToStaticMarkup(await RevisionLifecycle({ documentId: "master" })); expect(read).toHaveBeenCalledOnce();
    for (const text of ["Actor documental privado", "Motivo confidencial", "Metadatos privados", "sha-privado"]) expect(html).toContain(text);
  });
});
