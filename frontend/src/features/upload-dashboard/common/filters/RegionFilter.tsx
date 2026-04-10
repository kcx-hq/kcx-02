type FilterOption = {
  label: string;
  value: string;
};

type RegionFilterProps = {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
};

export function RegionFilter({ value, options, onChange }: RegionFilterProps) {
  return (
    <label className="dashboard-template-filter-field">
      <span className="dashboard-template-filter-field__label">Region</span>
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
