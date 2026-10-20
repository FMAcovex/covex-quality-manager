import { classifyDue } from "@/modules/dashboard/domain";

export type DueTone = "overdue" | "upcoming" | null;

/** Color del plazo en la franja de datos clave: la misma regla que el panel (vencido / 30 días). Cerrado, sin color. */
export function dueTone(due: Date | null | undefined, today: Date, closed: boolean): DueTone {
  if (closed || !due) return null;
  const due0 = classifyDue(due, today);
  return due0 === "OVERDUE" ? "overdue" : due0 === "UPCOMING" ? "upcoming" : null;
}
