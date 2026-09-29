import { CapaProposalStatus } from "@prisma/client";

export function capaProposalStatusLabel(status: CapaProposalStatus) {
  if (status === CapaProposalStatus.REGISTERED) return "Registrada";
  if (status === CapaProposalStatus.CANCELLED) return "Cancelada";
  return "Pendiente";
}

export type CapaPlanNavigation =
  | { kind: "CREATE" }
  | { kind: "OPEN"; recordId: string }
  | { kind: "NONE" };

export function capaPlanNavigation(input: {
  proposalStatus: CapaProposalStatus;
  linkedCapaRecordId: string | null;
}): CapaPlanNavigation {
  if (input.linkedCapaRecordId) {
    return { kind: "OPEN", recordId: input.linkedCapaRecordId };
  }

  if (input.proposalStatus === CapaProposalStatus.PROPOSED) {
    return { kind: "CREATE" };
  }

  return { kind: "NONE" };
}
