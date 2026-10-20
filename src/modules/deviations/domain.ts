export const deviationProvenanceOptions = [
  { value: "FINISHED_PRODUCT_SYSTEM", label: "Producto terminado / Sistema" },
  { value: "CLIENT", label: "Cliente" },
  { value: "RAW_PACKAGING_MATERIAL", label: "Materia prima / Material de acondicionamiento" },
  { value: "SUPPLIER", label: "Proveedor" },
  { value: "EQUIPMENT_LINE", label: "Equipo / Línea afectada" },
  { value: "OTHER", label: "Otros" },
] as const;

// Valores de procedencia de expedientes antiguos: se traducen al mostrarlos, pero no se ofrecen al registrar.
const legacyProvenanceLabels: Record<string, string> = {
  DOCUMENTATION: "Documentación",
  PROCESS: "Proceso",
  EQUIPMENT: "Equipo",
  MATERIAL: "Material",
};

export function deviationProvenanceLabel(value: string | null | undefined): string {
  return deviationProvenanceOptions.find((option) => option.value === value)?.label
    ?? (value ? legacyProvenanceLabels[value] : undefined)
    ?? (value?.trim() || "—");
}

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
