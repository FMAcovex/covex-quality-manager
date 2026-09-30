type MultiSelectOption = {
  value: string;
  label: string;
};

export function MultiSelectFilter({
  name,
  label,
  options,
  selected = [],
}: {
  name: string;
  label: string;
  options: MultiSelectOption[];
  selected?: string[];
}) {
  const selectedSet = new Set(selected);
  const selectedLabels = options.filter((option) => selectedSet.has(option.value)).map((option) => option.label);
  const summary =
    selectedLabels.length === 0
      ? "Todos"
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels.length} seleccionados`;

  return (
    <details className="filter-placeholder multi-filter">
      <summary>
        <span>{label}</span>
        <strong>{summary}</strong>
      </summary>
      <div className="multi-filter-menu">
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selectedSet.has(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
