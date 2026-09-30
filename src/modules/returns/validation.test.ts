import { describe, expect, it } from "vitest";
import { parseReturnForm } from "@/modules/returns/validation";

describe("parseReturnForm · D5.4D", () => {
  it("permite guardar una devolución borrador incompleta", () => {
    const form = new FormData();
    form.set("status", "DRAFT");
    form.set("productsJson", "[]");

    const parsed = parseReturnForm(form);

    expect(parsed.errors).toEqual([]);
    expect(parsed.values.status).toBe("DRAFT");
    expect(parsed.values.businessCode).toBeNull();
  });

  it("exige los campos operativos al pasar a abierta", () => {
    const form = new FormData();
    form.set("status", "OPEN");
    form.set("productsJson", "[]");

    const parsed = parseReturnForm(form);

    expect(parsed.errors).toContain("El área/almacén es obligatorio.");
    expect(parsed.errors).toContain("La fecha de comunicación es obligatoria.");
    expect(parsed.errors).toContain("Debe indicarse quién cumplimenta el expediente.");
    expect(parsed.errors).toContain("Debe seleccionarse el tipo de devolución.");
    expect(parsed.errors).toContain("Debe indicarse el cliente/entidad.");
    expect(parsed.errors).toContain("Debe registrarse al menos un producto devuelto.");
  });

  it("mantiene las reglas de cierre fuera de borrador", () => {
    const form = new FormData();
    form.set("status", "CLOSED");
    form.set("departmentId", "department-1");
    form.set("communicationDate", "2026-09-30");
    form.set("createdByText", "Usuario demo");
    form.set("returnType", "COMMERCIAL");
    form.set("customerEntity", "Cliente demo");
    form.set("productsJson", JSON.stringify([{productNameCode:"Producto demo",productType:"OTHER"}]));
    form.set("decision", "PENDING");

    const parsed = parseReturnForm(form);

    expect(parsed.errors).toContain("Una devolución cerrada requiere decisión Aceptada o Rechazada.");
    expect(parsed.errors).toContain("Una devolución cerrada requiere fecha de cierre.");
    expect(parsed.errors).toContain("Una devolución cerrada requiere destino final.");
  });
});
