/** Anclas de los apartados de la pestaña «Desviación» (D-111, V3). */
export const deviationPartAnchors = {
  description: "desviacion-descripcion",
  investigation: "desviacion-investigacion",
  actions: "desviacion-acciones",
  conclusion: "desviacion-conclusion",
} as const;

type LegacyTab = keyof typeof deviationPartAnchors;
const isLegacy = (tab: string | undefined): tab is LegacyTab => Boolean(tab && Object.hasOwn(deviationPartAnchors, tab));

/** Las pestañas Descripción, Investigación, Acciones y Conclusión pasan a ser apartados de «Desviación». */
export function legacyDeviationTab(tab: string | undefined): { tab: "deviation"; anchor: string } | null {
  return isLegacy(tab) ? { tab: "deviation", anchor: deviationPartAnchors[tab] } : null;
}
