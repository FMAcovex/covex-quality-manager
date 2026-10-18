import { ASSIGNED_TO_ME } from "@/lib/qms/assigned";

/** Filtro «Asignadas a mí» de los listados (D-102). */
export function AssignedListFilter({ value }: { value?: string }) {
  return <label className="filter-placeholder"><span>Asignación</span>
    <select name="assigned" defaultValue={value === ASSIGNED_TO_ME ? ASSIGNED_TO_ME : ""}>
      <option value="">Todas</option>
      <option value={ASSIGNED_TO_ME}>Asignadas a mí</option>
    </select>
  </label>;
}
