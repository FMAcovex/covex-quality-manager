import { describe, expect, it } from "vitest";
import { recordStatusPermissions, recordStatusTarget } from "./close-permission";

describe("permisos por el estado del expediente al guardarlo (como la página de edición, 4B1)", () => {
  it("guardar un expediente cerrado exige CLOSE (lo reabra o no); cerrarlo, también", () => {
    expect(recordStatusPermissions("CLOSED", "CLOSED")).toEqual(["CLOSE"]);
    expect(recordStatusPermissions("OPEN", "CLOSED")).toEqual(["CLOSE"]);
    expect(recordStatusPermissions(null, "CLOSED")).toEqual(["CLOSE"]);
    expect(recordStatusPermissions("CLOSED", "OPEN")).toEqual(["CLOSE"]);
    expect(recordStatusPermissions("CLOSED", null)).toEqual(["CLOSE"]);
    expect(recordStatusPermissions("OPEN", "OPEN")).toEqual([]);
    expect(recordStatusPermissions(null, null)).toEqual([]);
  });

  it("guardar un expediente cancelado exige ANNUL", () => {
    expect(recordStatusPermissions("OPEN", "CANCELLED")).toEqual(["ANNUL"]);
    expect(recordStatusPermissions("CLOSED", "CANCELLED")).toEqual(["CLOSE", "ANNUL"]);
  });

  it("el estado de destino sale del campo de cada módulo", () => {
    const form = (entries: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(entries)) data.set(key, value); return data; };
    expect(recordStatusTarget("updateChangeControlAction", form({ finalStatus: "CLOSED", status: "OPEN" }))).toBe("CLOSED");
    expect(recordStatusTarget("updateComplaintAction", form({ saveStatus: "OPEN", status: "CLOSED" }))).toBe("OPEN");
    expect(recordStatusTarget("updateComplaintAction", form({ status: "CLOSED" }))).toBe("CLOSED");
    expect(recordStatusTarget("updateDeviationAction", form({ status: " CLOSED " }))).toBe("CLOSED");
    expect(recordStatusTarget("updateDeviationAction", form({}))).toBeNull();
    // Como lo leen los formularios: sin viñetas vacías ni espacios.
    expect(recordStatusTarget("updateDeviationAction", form({ status: "CLOSED\n•" }))).toBe("CLOSED");
    expect(recordStatusTarget("updateComplaintAction", form({ saveStatus: "•\nCLOSED" }))).toBe("CLOSED");
    // Las auditorías no están: su servicio exige conservar «Cerrada» al editar una cerrada, así que la regla general de CLOSE ya las cubre.
    expect(recordStatusTarget("saveAuditAction", form({ status: "CLOSED" }))).toBeUndefined();
  });
});
