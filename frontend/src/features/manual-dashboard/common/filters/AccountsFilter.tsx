type AccountOption = {
  label: string;
  value: string;
};

type AccountsFilterProps = {
  options: AccountOption[];
  selectedValues: string[];
  onChange: (nextValues: string[]) => void;
};

export function AccountsFilter({ options, selectedValues, onChange }: AccountsFilterProps) {
  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((item) => item !== value));
      return;
    }

    onChange([...selectedValues, value]);
  };

  return (
    <div className="dashboard-template-filter-checkbox-group" role="group" aria-label="Accounts">
      {options.map((option) => (
        <label key={option.value} className="dashboard-template-filter-checkbox">
          <input
            type="checkbox"
            checked={selectedValues.includes(option.value)}
            onChange={() => toggleValue(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
