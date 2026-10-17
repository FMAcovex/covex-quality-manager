export type CapaFollowupLifecycleState = {
  status: "OPEN" | "CLOSED" | "CANCELLED";
  operationalClosedAt: string | null;
  cancellationReason: string | null;
  conclusion: string | null;
  effectivenessStatus: "CONFORMING" | "NONCONFORMING" | "PENDING" | "NA";
  effectivenessCriteria: string | null;
  effectivenessAssessment: string | null;
  effectivenessEvidence: string | null;
  effectiveClosedAt: string | null;
};

export type CapaFollowupTransitionValues = CapaFollowupLifecycleState & {
  followupDate: string;
  completedByText: string;
  reason: string | null;
  description: string;
  observations: string | null;
  evidenceReference: string | null;
  nextFollowupDate: string | null;
};

type ParseOptions = {
  current: CapaFollowupLifecycleState;
  hasExistingExecutionEvidence: boolean;
};

/** Estados que puede fijar un seguimiento de CAPA. */
export const capaFollowupStatuses = ["OPEN", "CLOSED", "CANCELLED"] as const;

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function validDate(value: string | null) {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function enumValue<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function submittedOrCurrent(
  formData: FormData,
  name: string,
  current: string | null,
) {
  return formData.has(name) ? text(formData, name) : current;
}

export function parseCapaFollowupTransition(
  formData: FormData,
  options: ParseOptions,
) {
  const followupDate = text(formData, "followupDate") ?? "";
  const completedByText = text(formData, "completedByText") ?? "";
  const reason = text(formData, "reason");
  const description = text(formData, "description") ?? "";
  const observations = text(formData, "observations");
  const evidenceReference = text(formData, "evidenceReference");
  const nextFollowupDate = text(formData, "nextFollowupDate");

  const status = enumValue(
    text(formData, "status"),
    capaFollowupStatuses,
    options.current.status,
  );
  const operationalClosedAt = submittedOrCurrent(
    formData,
    "operationalClosedAt",
    options.current.operationalClosedAt,
  );
  const cancellationReason = submittedOrCurrent(
    formData,
    "cancellationReason",
    options.current.cancellationReason,
  );
  const conclusion = submittedOrCurrent(
    formData,
    "conclusion",
    options.current.conclusion,
  );
  const effectivenessStatus = enumValue(
    text(formData, "effectivenessStatus"),
    ["CONFORMING", "NONCONFORMING", "PENDING", "NA"] as const,
    options.current.effectivenessStatus,
  );
  const effectivenessCriteria = submittedOrCurrent(
    formData,
    "effectivenessCriteria",
    options.current.effectivenessCriteria,
  );
  const effectivenessAssessment = submittedOrCurrent(
    formData,
    "effectivenessAssessment",
    options.current.effectivenessAssessment,
  );
  const effectivenessEvidence = submittedOrCurrent(
    formData,
    "effectivenessEvidence",
    options.current.effectivenessEvidence,
  );
  const effectiveClosedAt = submittedOrCurrent(
    formData,
    "effectiveClosedAt",
    options.current.effectiveClosedAt,
  );

  const errors: string[] = [];
  if (!followupDate) errors.push("La fecha del seguimiento es obligatoria.");
  else if (!validDate(followupDate)) {
    errors.push("La fecha del seguimiento no tiene un formato válido.");
  }
  if (!completedByText) errors.push("Debe indicarse quién cumplimenta el seguimiento.");
  if (!description) errors.push("La actuación realizada / resultado es obligatoria.");

  for (const [label, value] of [
    ["La próxima fecha de seguimiento", nextFollowupDate],
    ["La fecha de cierre operativo", operationalClosedAt],
    ["La fecha de cierre efectivo", effectiveClosedAt],
  ] as const) {
    if (value && !validDate(value)) {
      errors.push(`${label} no tiene un formato válido.`);
    }
  }

  if (status === "OPEN" && (!reason || !nextFollowupDate)) {
    errors.push(
      "Si la CAPA permanece abierta, el seguimiento debe indicar motivo y próxima fecha.",
    );
  }

  const closesOperationally =
    options.current.status !== "CLOSED" && status === "CLOSED";
  if (status === "CLOSED") {
    if (!operationalClosedAt) {
      errors.push("Una CAPA cerrada debe tener fecha de cierre operativo.");
    }
    if (!conclusion) {
      errors.push("Una CAPA cerrada debe tener conclusión de cierre.");
    }
  }
  if (
    closesOperationally &&
    !evidenceReference &&
    !options.hasExistingExecutionEvidence
  ) {
    errors.push(
      "El cierre operativo requiere evidencia de ejecución referenciada en un seguimiento.",
    );
  }

  // La verificación de eficacia se hace en el seguimiento siguiente al cierre de las acciones,
  // antes del cierre efectivo: mientras siga pendiente, ese seguimiento debe tener fecha.
  if (status === "CLOSED" && effectivenessStatus === "PENDING" && !effectiveClosedAt && !nextFollowupDate) {
    errors.push(
      "Con la eficacia pendiente, indica la fecha prevista de verificación de eficacia (próximo seguimiento).",
    );
  }

  if (status === "CANCELLED" && !cancellationReason) {
    errors.push("Una CAPA cancelada debe incluir el motivo de cancelación.");
  }

  if (effectiveClosedAt) {
    if (status !== "CLOSED") {
      errors.push("El cierre efectivo requiere que la CAPA esté cerrada operativamente.");
    }
    if (effectivenessStatus !== "CONFORMING") {
      errors.push("El cierre efectivo requiere eficacia Conforme.");
    }
    if (!effectivenessAssessment) {
      errors.push("El cierre efectivo requiere una valoración documentada de la eficacia.");
    }
  }

  if (effectivenessStatus === "NONCONFORMING" && effectiveClosedAt) {
    errors.push("Una eficacia No conforme no puede tener fecha de cierre efectivo.");
  }

  return {
    errors,
    values: {
      followupDate,
      completedByText,
      reason,
      description,
      observations,
      evidenceReference,
      nextFollowupDate,
      status,
      operationalClosedAt,
      cancellationReason,
      conclusion,
      effectivenessStatus,
      effectivenessCriteria,
      effectivenessAssessment,
      effectivenessEvidence,
      effectiveClosedAt,
    } satisfies CapaFollowupTransitionValues,
  };
}
