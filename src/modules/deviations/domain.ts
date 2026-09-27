export type MeasureShape = {
  immediateActions: unknown[];
  capaPlans: unknown[];
  capaRequired?: boolean | null;
};

export function measuresLabel(value: MeasureShape): string {
  const immediate = value.immediateActions.length > 0;
  const capa = value.capaPlans.length > 0 || value.capaRequired === true;

  if (immediate && capa) return "Correctiva inmediata + CAPA";
  if (capa) return "CAPA";
  if (immediate) return "Correctiva inmediata";
  return "Ninguna";
}

export function deadlineLabel(status: string): string {
  switch (status) {
    case "IN_TIME":
      return "Sí";
    case "OUT_OF_TIME":
      return "No";
    case "NA":
      return "N/A";
    default:
      return "No evaluado";
  }
}

export function triStateLabel(value: string | null | undefined): string {
  if (value === "YES") return "Sí";
  if (value === "NO") return "No";
  if (value === "NA") return "N/A";
  return "No informado";
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
