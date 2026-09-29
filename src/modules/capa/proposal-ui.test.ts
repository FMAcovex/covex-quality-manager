import { CapaProposalStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  capaPlanNavigation,
  capaProposalStatusLabel,
} from "@/modules/capa/proposal-ui";

describe("Navegación compartida de propuestas CAPA", () => {
  it("ofrece crear CAPA únicamente a una propuesta pendiente", () => {
    expect(
      capaPlanNavigation({
        proposalStatus: CapaProposalStatus.PROPOSED,
        linkedCapaRecordId: null,
      }),
    ).toEqual({ kind: "CREATE" });
  });

  it("abre la CAPA registrada cuando existe vínculo real", () => {
    expect(
      capaPlanNavigation({
        proposalStatus: CapaProposalStatus.REGISTERED,
        linkedCapaRecordId: "capa-qms-1",
      }),
    ).toEqual({ kind: "OPEN", recordId: "capa-qms-1" });
  });

  it("no ofrece crear una CAPA para propuestas canceladas o registradas sin vínculo", () => {
    expect(
      capaPlanNavigation({
        proposalStatus: CapaProposalStatus.CANCELLED,
        linkedCapaRecordId: null,
      }),
    ).toEqual({ kind: "NONE" });
    expect(
      capaPlanNavigation({
        proposalStatus: CapaProposalStatus.REGISTERED,
        linkedCapaRecordId: null,
      }),
    ).toEqual({ kind: "NONE" });
  });

  it("muestra etiquetas legibles para los tres estados", () => {
    expect(capaProposalStatusLabel(CapaProposalStatus.PROPOSED)).toBe("Pendiente");
    expect(capaProposalStatusLabel(CapaProposalStatus.REGISTERED)).toBe("Registrada");
    expect(capaProposalStatusLabel(CapaProposalStatus.CANCELLED)).toBe("Cancelada");
  });
});
