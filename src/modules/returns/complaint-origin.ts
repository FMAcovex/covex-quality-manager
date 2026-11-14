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

/**
 * RET1: la devolución propuesta (acción derivada de tipo devolución) que cubre la nueva devolución. Debe ser de la
 * reclamación de origen, no tener aún devolución y no tener otro borrador en curso (`exceptReturnId`: el propio
 * borrador al abrirlo). Bloquea la fila para que dos devoluciones no cubran la misma propuesta.
 */
export async function checkComplaintReturnProposal(
  client: ComplaintReturnProposalClient,
  complaintId: string,
  actionId: string,
  exceptReturnId?: string,
) {
  await client.$queryRaw`SELECT id FROM "ComplaintDerivedAction" WHERE id = ${actionId} FOR UPDATE`;
  const action = await client.complaintDerivedAction.findUnique({
    where: { id: actionId },
    select: { complaintId: true, actionType: true, businessCode: true },
  });
  if (!action || action.complaintId !== complaintId || action.actionType !== "RETURN")
    throw new ComplaintReturnLinkError("La devolución propuesta no pertenece a la reclamación de origen.");
  if (action.businessCode)
    throw new ComplaintReturnLinkError(`Esta devolución propuesta ya tiene una devolución (${action.businessCode}).`);
  const draft = await client.returnRecord.findFirst({
    where: {
      status: "DRAFT",
      qmsRecord: { isActive: true },
      extraData: { path: ["pendingComplaintActionId"], equals: actionId },
      ...(exceptReturnId ? { id: { not: exceptReturnId } } : {}),
    },
    select: { id: true },
  });
  if (draft)
    throw new ComplaintReturnLinkError("Ya hay un borrador de devolución para esta propuesta: ábralo desde la reclamación.");
}

/** RET1: al abrirse la devolución, la propuesta recibe su código y deja de ofrecer crear otra. */
export async function registerComplaintReturnProposal(
  client: ComplaintReturnProposalClient,
  input: { actionId: string; returnBusinessCode: string },
) {
  const updated = await client.complaintDerivedAction.updateMany({
    where: { id: input.actionId, actionType: "RETURN", businessCode: null },
    data: { businessCode: input.returnBusinessCode },
  });
  if (updated.count !== 1)
    throw new ComplaintReturnLinkError("La devolución propuesta ya está vinculada a otra devolución.");
}
