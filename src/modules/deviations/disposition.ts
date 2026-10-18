// Disposición final de la desviación (opción A): las mismas opciones que el Anexo III,
// para que el anexo marque exactamente lo registrado en el expediente.
export const dispositionOptions = [
  "Aprobado",
  "Rechazado",
  "Rechazado – Destruir",
  "Rechazado – Devolver",
  "Otro",
] as const;
export type DispositionOption = (typeof dispositionOptions)[number];

const fold = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[–—-]/g, "-").replace(/\s+/g, " ").trim().toUpperCase();

/** Opción registrada; un texto libre anterior que no coincide con ninguna se trata como «Otro» y se conserva. */
export function dispositionChoice(value: string | null | undefined): { option: DispositionOption | null; legacyText: string | null } {
  const text = value?.trim() ?? "";
  if (!text) return { option: null, legacyText: null };
  const option = dispositionOptions.find((item) => fold(item) === fold(text));
  return option ? { option, legacyText: null } : { option: "Otro", legacyText: text };
}

/**
 * Casillas del Anexo III (APROBADO, RECHAZADO, Destruir, Devolver, OTRO) y línea «Cantidad» que recibe
 * la cantidad (0 = aprobado, 1 = destruir, 2 = devolver).
 */
export function dispositionAnnexMarks(option: DispositionOption | null) {
  return {
    checkboxes: [
      option === "Aprobado",
      option === "Rechazado" || option === "Rechazado – Destruir" || option === "Rechazado – Devolver",
      option === "Rechazado – Destruir",
      option === "Rechazado – Devolver",
      option === "Otro",
    ],
    quantityLine: option === "Aprobado" ? 0 : option === "Rechazado – Destruir" ? 1 : option === "Rechazado – Devolver" ? 2 : null,
  };
}
