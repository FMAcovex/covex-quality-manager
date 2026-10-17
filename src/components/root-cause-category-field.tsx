import { ROOT_CAUSE_CATEGORIES } from "@/lib/qms/root-cause-categories";

/** Casillas de la categoría de causa raíz (6M); complementan a la causa raíz redactada. */
export function RootCauseCategoryField({ defaultValue = [], className = "field full" }: { defaultValue?: readonly string[]; className?: string }) {
  return (
    <div className={className} role="group" aria-labelledby="root-cause-categories-label">
      <span id="root-cause-categories-label">Categoría de causa raíz (6M)</span>
      <div className="checkbox-group">
        {ROOT_CAUSE_CATEGORIES.map(([value, label]) => (
          <label key={value}>
            <input type="checkbox" name="rootCauseCategories" value={value} defaultChecked={defaultValue.includes(value)} />
            {label}
          </label>
        ))}
      </div>
      <small className="muted-note">Clasificación para tendencias; no sustituye a la causa raíz redactada. Puede marcarse más de una.</small>
    </div>
  );
}
