type FilterOption = {
  label: string;
  value: string;
};

type ProviderFilterProps = {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
};

export function ProviderFilter({ value, options, onChange }: ProviderFilterProps) {
  return (
    <label className="dashboard-template-filter-field">
      <span className="dashboard-template-filter-field__label">Provider</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="dashboard-template-filter-field__control"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
