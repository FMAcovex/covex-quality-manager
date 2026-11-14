import { describe, expect, it } from "vitest";
import {
  ComplaintReturnLinkError,
  checkComplaintReturnProposal,
  complaintReturnProposalState,
  linkReturnToComplaint,
  registerComplaintReturnProposal,
  type ComplaintReturnProposalClient,
} from "@/modules/returns/complaint-origin";

// RET1: «Crear devolución» desde una devolución propuesta de la reclamación indica qué propuesta cubre. La propuesta
// recibe el código de la devolución al abrirse y deja de ofrecer crear otra; un segundo intento falla.
type Action = { id: string; complaintId: string; actionType: string; businessCode: string | null };
type Draft = { id: string; actionId: string; status: string; isActive: boolean };
function memory(actions: Action[], drafts: Draft[] = []) {
  const calls: string[] = [];
  const client = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => { calls.push(`lock:${strings.join("?").includes("FOR UPDATE") ? "FOR UPDATE" : "?"}:${String(values[0])}`); return []; },
    complaintDerivedAction: {
      findUnique: async ({ where }: { where: { id: string } }) => actions.find((a) => a.id === where.id) ?? null,
      updateMany: async ({ where, data }: { where: { id: string; actionType: string; businessCode: null }; data: { businessCode: string } }) => {
        calls.push("proposal");
        const rows = actions.filter((a) => a.id === where.id && a.actionType === where.actionType && a.businessCode === null);
        rows.forEach((a) => { a.businessCode = data.businessCode; });
        return { count: rows.length };
      },
    },
    returnRecord: {
      // Aplica los filtros de la consulta real: borrador, activo, la misma propuesta y no el propio.
      findFirst: async ({ where }: { where: { status: string; qmsRecord: { isActive: boolean }; extraData: { path: string[]; equals: string }; id?: { not: string } } }) =>
        drafts.find((d) => d.status === where.status && d.isActive === where.qmsRecord.isActive && where.extraData.path.join() === "pendingComplaintActionId" && d.actionId === where.extraData.equals && d.id !== where.id?.not) ?? null,
    },
    complaint: { findUnique: async () => null },
    qmsRecord: { findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, recordType: where.id.startsWith("c") ? "COMPLAINT" : "RETURN", businessCode: "X" }) },
    qmsRelation: { upsert: async () => { calls.push("relation"); return { id: "rel" }; }, findFirst: async () => null, findMany: async () => [] },
  };
  return { client: client as unknown as ComplaintReturnProposalClient, actions, calls };
}

const proposal = (over: Partial<Action> = {}): Action => ({ id: "action-1", complaintId: "complaint-1", actionType: "RETURN", businessCode: null, ...over });
const draft = (over: Partial<Draft> = {}): Draft => ({ id: "draft-1", actionId: "action-1", status: "DRAFT", isActive: true, ...over });

describe("estado de la devolución propuesta", () => {
  it("disponible: de la reclamación, de tipo devolución, sin código ni borrador; bloquea la fila", async () => {
    const { client, calls } = memory([proposal()]);
    expect(await complaintReturnProposalState(client, "complaint-1", "action-1")).toEqual({ state: "AVAILABLE" });
    expect(calls).toEqual(["lock:FOR UPDATE:action-1"]);
  });
  it("ya no existe: quitada de la reclamación, de otra reclamación o de otro tipo", async () => {
    for (const actions of [[], [proposal({ complaintId: "otra" })], [proposal({ actionType: "OTRA" })]])
      expect((await complaintReturnProposalState(memory(actions).client, "complaint-1", "action-1")).state).toBe("MISSING");
  });
  it("cubierta: ya tiene el código de otra devolución", async () => {
    expect(await complaintReturnProposalState(memory([proposal({ businessCode: "DEV/LG-10/001/2026" })]).client, "complaint-1", "action-1"))
      .toEqual({ state: "COVERED", businessCode: "DEV/LG-10/001/2026" });
  });
  it("reservada por otro borrador activo; no cuentan el propio, uno anulado ni uno ya abierto", async () => {
    expect((await complaintReturnProposalState(memory([proposal()], [draft()]).client, "complaint-1", "action-1")).state).toBe("RESERVED");
    expect((await complaintReturnProposalState(memory([proposal()], [draft()]).client, "complaint-1", "action-1", "draft-1")).state).toBe("AVAILABLE");
    expect((await complaintReturnProposalState(memory([proposal()], [draft({ isActive: false })]).client, "complaint-1", "action-1")).state).toBe("AVAILABLE");
    expect((await complaintReturnProposalState(memory([proposal()], [draft({ status: "OPEN" })]).client, "complaint-1", "action-1")).state).toBe("AVAILABLE");
  });
});

describe("alta desde la propuesta", () => {
  it("falla con un mensaje distinto por cada motivo", async () => {
    await expect(checkComplaintReturnProposal(memory([]).client, "complaint-1", "action-1")).rejects.toThrow(/ya no existe/);
    await expect(checkComplaintReturnProposal(memory([proposal({ businessCode: "DEV/LG-10/001/2026" })]).client, "complaint-1", "action-1")).rejects.toThrow(/ya tiene una devolución \(DEV\/LG-10\/001\/2026\)/);
    await expect(checkComplaintReturnProposal(memory([proposal()], [draft()]).client, "complaint-1", "action-1")).rejects.toThrow(/borrador/);
    await expect(checkComplaintReturnProposal(memory([proposal()]).client, "complaint-1", "action-1")).resolves.toBeUndefined();
  });
});

describe("registro del código en la propuesta", () => {
  it("al abrir la devolución, la propuesta recibe su código; una segunda vez falla", async () => {
    const { client, actions } = memory([proposal()]);
    await registerComplaintReturnProposal(client, { actionId: "action-1", returnBusinessCode: "DEV/LG-10/001/2026" });
    expect(actions[0].businessCode).toBe("DEV/LG-10/001/2026");
    await expect(registerComplaintReturnProposal(client, { actionId: "action-1", returnBusinessCode: "DEV/LG-10/002/2026" })).rejects.toBeInstanceOf(ComplaintReturnLinkError);
    expect(actions[0].businessCode).toBe("DEV/LG-10/001/2026");
  });
  it("no acepta un código vacío", async () => {
    const { client, actions } = memory([proposal()]);
    await expect(registerComplaintReturnProposal(client, { actionId: "action-1", returnBusinessCode: "" })).rejects.toBeInstanceOf(ComplaintReturnLinkError);
    expect(actions[0].businessCode).toBeNull();
  });
  it("escribe el código antes de crear la relación: la copia de la reclamación que hace la relación ya lo lleva", async () => {
    const { client, calls } = memory([proposal()]);
    const relate = async () => { calls.push("relation"); };
    await linkReturnToComplaint(client as never, { complaintQmsRecordId: "complaint-qms", returnQmsRecordId: "return-qms", actor: "QA", proposal: { actionId: "action-1", returnBusinessCode: "DEV/LG-10/001/2026" } }, relate);
    expect(calls.filter((c) => c === "proposal" || c === "relation")).toEqual(["proposal", "relation"]);
  });
});
