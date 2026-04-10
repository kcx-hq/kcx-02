type DateRangeOption = {
  label: string;
  value: string;
};

type DateRangeFilterProps = {
  value: string;
  options: DateRangeOption[];
  onChange: (value: string) => void;
};

export function DateRangeFilter({ value, options, onChange }: DateRangeFilterProps) {
  return (
    <div className="dashboard-template-filter-field">
      <span className="dashboard-template-filter-field__label">Date Range</span>
      <div className="dashboard-template-filter-radio-group" role="radiogroup" aria-label="Date range">
        {options.map((option) => (
          <label key={option.value} className="dashboard-template-filter-radio">
            <input
              type="radio"
              name="dashboard-template-date-range"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
