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
  qmsRecordId: true,
  qmsRecord: {
    select: {
      businessCode: true,
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
