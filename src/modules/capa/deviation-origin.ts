import { Prisma } from "@prisma/client";
import { createQmsRelation } from "@/lib/qms/relation-service";

export class DeviationCapaPlanLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeviationCapaPlanLinkError";
  }
}

export type DeviationCapaPlanClient = Pick<
  Prisma.TransactionClient,
  "deviationCapaPlan" | "qmsRecord" | "qmsRelation"
>;

const planSelect = {
  id: true,
  linkedCapaRecordId: true,
  proposalStatus: true,
  deviation: {
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

export async function getDeviationCapaPlanOrigin(
  client: DeviationCapaPlanClient,
  planId: string,
) {
  const plan = await client.deviationCapaPlan.findUnique({
    where: { id: planId },
    select: planSelect,
  });

  if (!plan) {
    throw new DeviationCapaPlanLinkError(
      "La propuesta CAPA de la desviación ya no existe.",
    );
  }

  if (plan.proposalStatus === "CANCELLED") {
    throw new DeviationCapaPlanLinkError(
      "La propuesta CAPA está cancelada y no puede generar una CAPA.",
    );
  }

  if (plan.proposalStatus !== "PROPOSED" || plan.linkedCapaRecordId) {
    throw new DeviationCapaPlanLinkError(
      "Esta propuesta ya está registrada como una CAPA y no puede generar otra distinta.",
    );
  }

  return {
    planId: plan.id,
    deviationQmsRecordId: plan.deviation.qmsRecordId,
    deviationBusinessCode: plan.deviation.qmsRecord.businessCode,
  };
}

export async function registerDeviationCapaPlan(
  client: DeviationCapaPlanClient,
  input: {
    planId: string;
    capaQmsRecordId: string;
    capaBusinessCode: string | null;
    actor: string;
  },
) {
  const plan = await client.deviationCapaPlan.findUnique({
    where: { id: input.planId },
    select: planSelect,
  });

  if (!plan) {
    throw new DeviationCapaPlanLinkError(
      "La propuesta CAPA de la desviación ya no existe.",
    );
  }

  if (plan.proposalStatus === "CANCELLED") {
    throw new DeviationCapaPlanLinkError(
      "La propuesta CAPA está cancelada y no puede registrarse.",
    );
  }

  if (plan.proposalStatus !== "PROPOSED" || plan.linkedCapaRecordId) {
    throw new DeviationCapaPlanLinkError(
      "Esta propuesta ya está registrada como una CAPA y no puede reasignarse a otra.",
    );
  }

  const updated = await client.deviationCapaPlan.updateMany({
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
    throw new DeviationCapaPlanLinkError(
      "La propuesta CAPA ha cambiado mientras se registraba. Recarga la desviación antes de continuar.",
    );
  }

  await createQmsRelation(client, {
    sourceRecordId: plan.deviation.qmsRecordId,
    targetRecordId: input.capaQmsRecordId,
    createdByText: input.actor,
    notes: "CAPA creada desde la propuesta registrada en la desviación.",
  });

  return {
    deviationQmsRecordId: plan.deviation.qmsRecordId,
    deviationBusinessCode: plan.deviation.qmsRecord.businessCode,
  };
}
