import "server-only";
import { listRecordFigures } from "@/lib/qms/record-evidence";
import { numberFigures, type FigureSection } from "./figures";
import type { FigureView } from "./components/figure-thumbs";

/** D-125: figuras del expediente numeradas y agrupadas por apartado, para el formulario y la ficha. */
export async function deviationFiguresBySection(qmsRecordId: string) {
  const grouped: Partial<Record<FigureSection, FigureView[]>> = {};
  for (const figure of numberFigures(await listRecordFigures(qmsRecordId))) {
    const section = figure.section as FigureSection;
    (grouped[section] ??= []).push({ id: figure.id, number: figure.number, description: figure.description });
  }
  return grouped;
}
