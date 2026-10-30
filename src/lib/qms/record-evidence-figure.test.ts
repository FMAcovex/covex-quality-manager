import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: vi.fn(() => { throw new Error("no debería llegar a guardar"); }) } }));
const { storeRecordEvidence } = await import("./record-evidence");

// D-125: una figura de un apartado solo puede ser una imagen; se comprueba antes de guardar nada.
describe("Figuras: solo imágenes (D-125)", () => {
  it("rechaza un PDF como figura de un apartado", async () => {
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46])], "informe.pdf", { type: "application/pdf" });
    await expect(storeRecordEvidence({ qmsRecordId: "r", file: pdf, description: "Informe", reference: "", actor: "QA", figure: { section: "INVESTIGATION", label: "E. Investigación" } }))
      .rejects.toThrow(/Una figura debe ser una imagen PNG o JPG|Solo se admiten/);
  });

  it("rechaza una imagen cuyo tamaño no se puede leer (rompería el Anexo III)", async () => {
    const broken = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])], "rota.jpg", { type: "image/jpeg" });
    await expect(storeRecordEvidence({ qmsRecordId: "r", file: broken, description: "Rota", reference: "", actor: "QA", figure: { section: "INVESTIGATION", label: "E. Investigación" } }))
      .rejects.toThrow("No se puede leer el tamaño de la figura.");
  });
});

