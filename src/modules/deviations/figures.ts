/**
 * D-125: figuras pegadas en los apartados de una desviación. Cada figura es una evidencia del
 * expediente (inalterable, con su SHA-256) con el apartado al que ilustra. Se numeran por orden de
 * alta en todo el expediente («Figura 1, 2…») y se imprimen en una hoja «Figuras» al final del Anexo III.
 */
export const DEVIATION_FIGURE_SECTIONS = [
  ["DESCRIPTION", "C. Descripción del evento"],
  ["IMMEDIATE_ACTIONS", "D. Acción inmediata"],
  ["INVESTIGATION", "E. Investigación"],
  ["ROOT_CAUSE", "F-G. Causa raíz"],
  ["IMPACT", "I. Impacto"],
  ["CONCLUSION", "K-L. Conclusión y cierre"],
] as const;

export type FigureSection = (typeof DEVIATION_FIGURE_SECTIONS)[number][0];

/** Apartado enviado con la figura; vacío es una evidencia normal (sin apartado). */
export function parseFigureSection(value: unknown): FigureSection | null {
  if (value === null || value === undefined || value === "") return null;
  const found = DEVIATION_FIGURE_SECTIONS.find(([key]) => key === value);
  if (!found) throw new Error("Apartado de la figura no válido.");
  return found[0];
}

export const figureSectionLabel = (section: string) => DEVIATION_FIGURE_SECTIONS.find(([key]) => key === section)?.[1] ?? section;

/** Número de cada figura: orden de alta en todo el expediente (las evidencias no se borran, así que no cambia). */
export function numberFigures<T extends { id: string; generatedAt: Date }>(figures: readonly T[]): (T & { number: number })[] {
  return [...figures]
    .sort((a, b) => a.generatedAt.getTime() - b.generatedAt.getTime() || (a.id < b.id ? -1 : 1))
    .map((figure, index) => ({ ...figure, number: index + 1 }));
}
