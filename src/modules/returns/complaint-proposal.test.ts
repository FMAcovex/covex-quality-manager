import { describe, expect, it } from "vitest";
import {
  ComplaintReturnLinkError,
  checkComplaintReturnProposal,
  registerComplaintReturnProposal,
  type ComplaintReturnProposalClient,
} from "@/modules/returns/complaint-origin";

// RET1: «Crear devolución» desde una devolución propuesta de la reclamación indica qué propuesta cubre. La propuesta
// recibe el código de la devolución al abrirse y deja de ofrecer crear otra; un segundo intento falla.
type Action = { id: string; complaintId: string; actionType: string; businessCode: string | null };
function memory(actions: Action[], drafts: Array<{ id: string; actionId: string }> = []) {
  const locked: string[] = [];
  const client = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => { locked.push(String(values[0])); return []; },
    complaintDerivedAction: {
      findUnique: async ({ where }: { where: { id: string } }) => actions.find((a) => a.id === where.id) ?? null,
      updateMany: async ({ where, data }: { where: { id: string; actionType: string; businessCode: null }; data: { businessCode: string } }) => {
        const rows = actions.filter((a) => a.id === where.id && a.actionType === where.actionType && a.businessCode === null);
        rows.forEach((a) => { a.businessCode = data.businessCode; });
        return { count: rows.length };
      },
    },
    returnRecord: {
      findFirst: async ({ where }: { where: { extraData: { equals: string }; id?: { not: string } } }) =>
        drafts.find((d) => d.actionId === where.extraData.equals && d.id !== where.id?.not) ?? null,
    },
  };
  return { client: client as unknown as ComplaintReturnProposalClient, actions, locked };
}

const proposal = (over: Partial<Action> = {}): Action => ({ id: "action-1", complaintId: "complaint-1", actionType: "RETURN", businessCode: null, ...over });

describe("propuesta de devolución de la reclamación", () => {
  it("acepta una propuesta de devolución de la reclamación de origen, sin código y sin borrador, y la bloquea", async () => {
    const { client, locked } = memory([proposal()]);
    await expect(checkComplaintReturnProposal(client, "complaint-1", "action-1")).resolves.toBeUndefined();
    expect(locked).toEqual(["action-1"]);
  });
  it("rechaza una propuesta de otra reclamación o que no es una devolución", async () => {
    await expect(checkComplaintReturnProposal(memory([proposal({ complaintId: "otra" })]).client, "complaint-1", "action-1")).rejects.toBeInstanceOf(ComplaintReturnLinkError);
    await expect(checkComplaintReturnProposal(memory([proposal({ actionType: "CAPA" })]).client, "complaint-1", "action-1")).rejects.toBeInstanceOf(ComplaintReturnLinkError);
    await expect(checkComplaintReturnProposal(memory([]).client, "complaint-1", "action-1")).rejects.toBeInstanceOf(ComplaintReturnLinkError);
  });
  it("rechaza una propuesta que ya tiene devolución", async () => {
    await expect(checkComplaintReturnProposal(memory([proposal({ businessCode: "DEV/LG-10/001/2026" })]).client, "complaint-1", "action-1"))
      .rejects.toThrow(/ya tiene una devolución/);
  });
  it("rechaza una propuesta con otro borrador en curso, salvo el propio borrador al abrirlo", async () => {
    const { client } = memory([proposal()], [{ id: "draft-1", actionId: "action-1" }]);
    await expect(checkComplaintReturnProposal(client, "complaint-1", "action-1")).rejects.toThrow(/borrador/);
    await expect(checkComplaintReturnProposal(client, "complaint-1", "action-1", "draft-1")).resolves.toBeUndefined();
  });
  it("al abrir la devolución, la propuesta recibe su código; una segunda vez falla", async () => {
    const { client, actions } = memory([proposal()]);
    await registerComplaintReturnProposal(client, { actionId: "action-1", returnBusinessCode: "DEV/LG-10/001/2026" });
    expect(actions[0].businessCode).toBe("DEV/LG-10/001/2026");
    await expect(registerComplaintReturnProposal(client, { actionId: "action-1", returnBusinessCode: "DEV/LG-10/002/2026" }))
      .rejects.toBeInstanceOf(ComplaintReturnLinkError);
    expect(actions[0].businessCode).toBe("DEV/LG-10/001/2026");
  });
});
