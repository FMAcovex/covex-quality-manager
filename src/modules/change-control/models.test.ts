import { describe, expect, it, vi } from "vitest";
import type { ChangeControlModel } from "@prisma/client";

vi.mock("../../lib/db", () => ({ prisma: {} }));
const { ChangeModelError, changeModelDefaults, createChangeModel, createdFromModelNote, parseChangeModelForm, parseModelTasks, updateChangeModel } = await import("./models");

// D-122: modelos de Control de cambios: qué se valida y qué prerrellenan.
function form(values: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) for (const item of [value].flat()) fd.append(key, item);
  return fd;
}
const base = { name: "Cambio de proveedor", actor: "QA" };

describe("Modelos de Control de cambios", () => {
  it("lee el formulario: acciones una por línea y alcance «Otros» si se especifica", () => {
    const parsed = parseChangeModelForm(form({ ...base, scope: ["SUPPLIER"], otherScope: "Transporte", tasks: "Cualificar al proveedor\n\n  Actualizar el PNT de recepción  \n", isActive: "true" }));
    expect(parsed.tasks).toEqual(["Cualificar al proveedor", "Actualizar el PNT de recepción"]);
    expect(parsed.scope).toEqual(["SUPPLIER", "OTHER"]);
    expect(parsed.isActive).toBe(true);
    expect(parsed.departmentId).toBeNull();
    expect(parseModelTasks("a\r\nb")).toEqual(["a", "b"]);
  });

  it("valida en servidor nombre, alcance, responsable y límites", () => {
    expect(() => parseChangeModelForm(form({ ...base, name: " " }))).toThrow("Indica el nombre del modelo.");
    expect(() => parseChangeModelForm(form({ ...base, actor: "" }))).toThrow("Indica el responsable del registro.");
    expect(() => parseChangeModelForm(form({ ...base, scope: ["INVENTADO"] }))).toThrow("Alcance no válido.");
    expect(() => parseChangeModelForm(form({ ...base, tasks: Array.from({ length: 31 }, (_, i) => `Acción ${i}`).join("\n") }))).toThrow("Como máximo 30 acciones.");
    expect(() => parseChangeModelForm(form({ ...base, tasks: "x".repeat(501) }))).toThrow("como máximo 500");
    expect(parseChangeModelForm(form({ ...base, isActive: "false" })).isActive).toBe(false);
  });

  it("prerrellena solo la solicitud y las acciones, sin responsables, fechas ni decisiones", () => {
    const model = { id: "m", name: "Cambio de proveedor", purpose: null, isActive: true, departmentId: "dep", scope: ["SUPPLIER"], otherScope: null, changeDescription: "Describe el material", justification: null, providedDocuments: "Ficha técnica", tasks: ["Cualificar al proveedor", 3], version: 2, createdByText: "QA", updatedByText: "QA", createdAt: new Date(), updatedAt: new Date() } as unknown as ChangeControlModel;
    const defaults = changeModelDefaults(model);
    expect(defaults).toEqual({
      departmentId: "dep", scope: ["SUPPLIER"], otherScope: undefined, description: "Describe el material", justification: undefined, providedDocuments: "Ficha técnica",
      tasks: [{ departmentId: "dep", description: "Cualificar al proveedor", responsible: "", plannedDate: "" }],
    });
    for (const key of ["requestDate", "requesterName", "evaluation", "classification", "dictamenResult", "requestDecision", "plannedImplementationDate", "committeeRequired"]) expect(defaults).not.toHaveProperty(key);
    expect(createdFromModelNote(model)).toBe("desde el modelo «Cambio de proveedor» (versión 2)");
  });

  it("solo admite un departamento inactivo si el modelo ya lo tenía, y anota el historial por id", async () => {
    const stored = { id: "m1", name: "Cambio de proveedor", purpose: null, isActive: true, departmentId: "old", scope: [], otherScope: null, changeDescription: null, justification: null, providedDocuments: null, tasks: [], version: 1, createdByText: "QA", updatedByText: "QA", createdAt: new Date(), updatedAt: new Date("2026-10-01T00:00:00Z") };
    const history: { entityKey: string; action: string }[] = [];
    const tx = {
      $executeRaw: vi.fn(), $queryRaw: vi.fn(),
      department: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ isActive: where.id !== "old" })) },
      changeControlModel: {
        findFirst: vi.fn(async () => null), findUnique: vi.fn(async () => stored),
        create: vi.fn(async ({ data }: { data: object }) => ({ ...stored, ...data, id: "new" })),
        update: vi.fn(async ({ data }: { data: object }) => ({ ...stored, ...data })),
      },
      configurationChange: { create: vi.fn(async ({ data }: { data: { entityKey: string; action: string } }) => { history.push(data); }) },
    };
    const db = { $transaction: (run: (client: typeof tx) => unknown) => run(tx) } as never;
    const input = (values: Record<string, string>) => parseChangeModelForm(form({ ...base, isActive: "true", ...values }));
    const rejected = createChangeModel(input({ departmentId: "old" }), null, db);
    await expect(rejected).rejects.toBeInstanceOf(ChangeModelError);
    await expect(rejected).rejects.toThrow("El departamento elegido no está activo.");
    await createChangeModel(input({ departmentId: "dep" }), null, db);
    await updateChangeModel("m1", input({ departmentId: "old", purpose: "Nuevo propósito" }), null, db);
    expect(history).toEqual([expect.objectContaining({ entityKey: "new", action: "CREATE" }), expect.objectContaining({ entityKey: "m1", action: "UPDATE" })]);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2); // el bloqueo de nombres en cada guardado válido
  });
});
