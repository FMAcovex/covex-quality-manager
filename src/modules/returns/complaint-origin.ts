import { Prisma } from "@prisma/client";
import { createQmsRelation } from "@/lib/qms/relation-service";

export class ComplaintReturnLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplaintReturnLinkError";
  }
}

export type ComplaintReturnClient = Pick<
  Prisma.TransactionClient,
  "complaint" | "qmsRecord" | "qmsRelation"
>;

const complaintSelect = {
  status:true,
  qmsRecordId: true,
  qmsRecord: {
    select: {
      businessCode: true,
      isActive:true,
    },
  },
} as const;

export async function getComplaintReturnOrigin(
  client: ComplaintReturnClient,
  complaintId: string,
) {
  const complaint = await client.complaint.findUnique({
    where: { id: complaintId },
    select: complaintSelect,
  });

  if (!complaint) {
    throw new ComplaintReturnLinkError(
      "La reclamación de origen ya no existe.",
    );
  }

  if(complaint.status==="DRAFT"||complaint.qmsRecord.isActive===false)throw new ComplaintReturnLinkError("La reclamación de origen debe estar activa y operativa.");

  return {
    complaintQmsRecordId: complaint.qmsRecordId,
    complaintBusinessCode: complaint.qmsRecord.businessCode,
  };
}

export async function registerComplaintReturnOrigin(
  client: ComplaintReturnClient,
  input: {
    complaintQmsRecordId: string;
    returnQmsRecordId: string;
    actor: string;
  },
) {
  await createQmsRelation(client, {
    sourceRecordId: input.complaintQmsRecordId,
    targetRecordId: input.returnQmsRecordId,
    createdByText: input.actor,
    notes: "Devolución creada desde la reclamación.",
  });
}

export type ComplaintReturnProposalClient = Pick<Prisma.TransactionClient, "$queryRaw" | "complaintDerivedAction" | "returnRecord">;

export type ComplaintReturnProposalState =
  | { state: "AVAILABLE" }
  | { state: "MISSING" }
  | { state: "COVERED"; businessCode: string }
  | { state: "RESERVED" };

/**
 * RET1: estado de la devolución propuesta (acción derivada de tipo devolución) que cubrirá una devolución:
 * disponible, ya no existe en la reclamación, ya cubierta por otra devolución o reservada por otro borrador
 * activo (`exceptReturnId`: el propio borrador al abrirlo). Bloquea la fila: dos devoluciones no cubren la misma
 * (`lock = false` solo para avisar al cargar el formulario, fuera de una transacción).
 */
export async function complaintReturnProposalState(
  client: ComplaintReturnProposalClient,
  complaintId: string,
  actionId: string,
  exceptReturnId?: string,
  lock = true,
): Promise<ComplaintReturnProposalState> {
  if (lock) await client.$queryRaw`SELECT id FROM "ComplaintDerivedAction" WHERE id = ${actionId} FOR UPDATE`;
  const action = await client.complaintDerivedAction.findUnique({
    where: { id: actionId },
    select: { complaintId: true, actionType: true, businessCode: true },
  });
  if (!action || action.complaintId !== complaintId || action.actionType !== "RETURN") return { state: "MISSING" };
  if (action.businessCode) return { state: "COVERED", businessCode: action.businessCode };
  const draft = await client.returnRecord.findFirst({
    where: {
      status: "DRAFT",
      qmsRecord: { isActive: true },
      extraData: { path: ["pendingComplaintActionId"], equals: actionId },
      ...(exceptReturnId ? { id: { not: exceptReturnId } } : {}),
    },
    select: { id: true },
  });
  return draft ? { state: "RESERVED" } : { state: "AVAILABLE" };
}

/** RET1: al crear la devolución desde la propuesta, esta debe estar disponible; si no, un mensaje por motivo. */
export async function checkComplaintReturnProposal(
  client: ComplaintReturnProposalClient,
  complaintId: string,
  actionId: string,
) {
  const problem = complaintReturnProposalProblem(await complaintReturnProposalState(client, complaintId, actionId));
  if (problem) throw new ComplaintReturnLinkError(problem);
}

/** RET1: motivo por el que no se puede crear una devolución desde la propuesta, o null. */
export function complaintReturnProposalProblem(result: ComplaintReturnProposalState) {
  if (result.state === "MISSING")
    return "La devolución propuesta ya no existe en la reclamación de origen: vuelva a la reclamación.";
  if (result.state === "COVERED")
    return `Esta devolución propuesta ya tiene una devolución (${result.businessCode}).`;
  if (result.state === "RESERVED")
    return "Ya hay un borrador de devolución para esta propuesta: ábralo desde la reclamación.";
  return null;
}

/** RET1: al abrirse la devolución, la propuesta recibe su código y deja de ofrecer crear otra. */
export async function registerComplaintReturnProposal(
  client: Pick<Prisma.TransactionClient, "complaintDerivedAction">,
  input: { actionId: string; returnBusinessCode: string | null | undefined },
) {
  if (!input.returnBusinessCode)
    throw new ComplaintReturnLinkError("La devolución debe tener código para vincularla a la devolución propuesta.");
  const updated = await client.complaintDerivedAction.updateMany({
    where: { id: input.actionId, actionType: "RETURN", businessCode: null },
    data: { businessCode: input.returnBusinessCode },
  });
  if (updated.count !== 1)
    throw new ComplaintReturnLinkError("La devolución propuesta ya está vinculada a otra devolución.");
}

/**
 * RET1: vincula la devolución abierta a su reclamación y, si cubre una propuesta, le pone su código. El código va
 * antes que la relación: al crearla, la reclamación copia su versión vigente (con las propuestas) y debe llevarlo.
 */
export async function linkReturnToComplaint(
  client: ComplaintReturnClient & Pick<Prisma.TransactionClient, "complaintDerivedAction">,
  input: { complaintQmsRecordId: string; returnQmsRecordId: string; actor: string; proposal?: { actionId: string; returnBusinessCode: string | null | undefined } },
  relate: typeof registerComplaintReturnOrigin = registerComplaintReturnOrigin,
) {
  if (input.proposal) await registerComplaintReturnProposal(client, input.proposal);
  await relate(client, { complaintQmsRecordId: input.complaintQmsRecordId, returnQmsRecordId: input.returnQmsRecordId, actor: input.actor });
}
