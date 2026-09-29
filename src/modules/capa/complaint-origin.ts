import { Prisma } from "@prisma/client";
import { createQmsRelation } from "@/lib/qms/relation-service";

export class ComplaintCapaLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplaintCapaLinkError";
  }
}

export type ComplaintCapaClient = Pick<
  Prisma.TransactionClient,
  "complaintCapaPlan" | "complaint" | "qmsRecord" | "qmsRelation"
>;

const planSelect = {
  id: true,
  linkedCapaRecordId: true,
  proposalStatus: true,
  complaint: {
    select: {
      qmsRecordId: true,
      qmsRecord: {
        select: {
          businessCode: true,
        },
      },
    },
  },
} as const;

const complaintSelect = {
  qmsRecordId: true,
  qmsRecord: {
    select: {
      businessCode: true,
    },
  },
} as const;

export async function getComplaintCapaPlanOrigin(
  client: ComplaintCapaClient,
  planId: string,
) {
  const plan = await client.complaintCapaPlan.findUnique({
    where: { id: planId },
    select: planSelect,
  });

  if (!plan) {
    throw new ComplaintCapaLinkError(
      "La propuesta CAPA de la reclamación ya no existe.",
    );
  }

  if (plan.proposalStatus === "CANCELLED") {
    throw new ComplaintCapaLinkError(
      "La propuesta CAPA está cancelada y no puede generar una CAPA.",
    );
  }

  if (plan.proposalStatus !== "PROPOSED" || plan.linkedCapaRecordId) {
    throw new ComplaintCapaLinkError(
      "Esta propuesta ya está registrada como una CAPA y no puede generar otra distinta.",
    );
  }

  return {
    planId: plan.id,
    complaintQmsRecordId: plan.complaint.qmsRecordId,
    complaintBusinessCode: plan.complaint.qmsRecord.businessCode,
  };
}

export async function getComplaintDirectOrigin(
  client: ComplaintCapaClient,
  complaintId: string,
) {
  const complaint = await client.complaint.findUnique({
    where: { id: complaintId },
    select: complaintSelect,
  });

  if (!complaint) {
    throw new ComplaintCapaLinkError(
      "La reclamación de origen ya no existe.",
    );
  }

  return {
    complaintQmsRecordId: complaint.qmsRecordId,
    complaintBusinessCode: complaint.qmsRecord.businessCode,
  };
}

export async function registerComplaintCapaPlan(
  client: ComplaintCapaClient,
  input: {
    planId: string;
    capaQmsRecordId: string;
    capaBusinessCode: string;
    actor: string;
  },
) {
  const plan = await client.complaintCapaPlan.findUnique({
    where: { id: input.planId },
    select: planSelect,
  });

  if (!plan) {
    throw new ComplaintCapaLinkError(
      "La propuesta CAPA de la reclamación ya no existe.",
    );
  }

  if (plan.proposalStatus === "CANCELLED") {
    throw new ComplaintCapaLinkError(
      "La propuesta CAPA está cancelada y no puede registrarse.",
    );
  }

  if (plan.proposalStatus !== "PROPOSED" || plan.linkedCapaRecordId) {
    throw new ComplaintCapaLinkError(
      "Esta propuesta ya está registrada como una CAPA y no puede reasignarse a otra.",
    );
  }

  const updated = await client.complaintCapaPlan.updateMany({
    where: {
      id: input.planId,
      proposalStatus: "PROPOSED",
      linkedCapaRecordId: null,
    },
    data: {
      linkedCapaRecordId: input.capaQmsRecordId,
      businessCapaCode: input.capaBusinessCode,
      proposalStatus: "REGISTERED",
    },
  });

  if (updated.count !== 1) {
    throw new ComplaintCapaLinkError(
      "La propuesta CAPA ha cambiado mientras se registraba. Recarga la reclamación antes de continuar.",
    );
  }

  await createQmsRelation(client, {
    sourceRecordId: plan.complaint.qmsRecordId,
    targetRecordId: input.capaQmsRecordId,
    createdByText: input.actor,
    notes: "CAPA creada desde la propuesta registrada en la reclamación.",
  });

  return {
    complaintQmsRecordId: plan.complaint.qmsRecordId,
    complaintBusinessCode: plan.complaint.qmsRecord.businessCode,
  };
}

export async function registerComplaintDirectOrigin(
  client: ComplaintCapaClient,
  input: {
    complaintQmsRecordId: string;
    capaQmsRecordId: string;
    actor: string;
  },
) {
  await createQmsRelation(client, {
    sourceRecordId: input.complaintQmsRecordId,
    targetRecordId: input.capaQmsRecordId,
    createdByText: input.actor,
    notes: "CAPA creada directamente desde una reclamación.",
  });
}
