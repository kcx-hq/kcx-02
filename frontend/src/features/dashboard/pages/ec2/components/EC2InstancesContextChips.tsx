type EC2InstancesChip = {
  id: string;
  label: string;
  onRemove?: () => void;
};

type EC2InstancesContextChipsProps = {
  chips: EC2InstancesChip[];
  explorerContextLabel?: string | null;
  onClearExplorerContext?: () => void;
  onClearAll?: () => void;
};

export function EC2InstancesContextChips({
  chips,
  explorerContextLabel,
  onClearExplorerContext,
  onClearAll,
}: EC2InstancesContextChipsProps) {
  const showExplorerContext = Boolean(explorerContextLabel);
  const showBar = chips.length > 0 || showExplorerContext;

  if (!showBar) return null;

  return (
    <section className="cost-explorer-chip-bar" aria-label="Active filters">
      <div className="cost-explorer-chip-row">
        {chips.map((chip) => (
          <span className="cost-explorer-chip" key={chip.id}>
            <button type="button" className="cost-explorer-chip__edit" title={chip.label}>
              {chip.label}
            </button>
            {chip.onRemove ? (
              <button type="button" className="cost-explorer-chip__remove" onClick={chip.onRemove} aria-label={`Remove ${chip.label}`}>
                x
              </button>
            ) : null}
          </span>
        ))}

        {showExplorerContext ? (
          <span className="cost-explorer-chip">
            <button type="button" className="cost-explorer-chip__edit" title={explorerContextLabel ?? undefined}>
              {explorerContextLabel}
            </button>
          </span>
        ) : null}

        {showExplorerContext && onClearExplorerContext ? (
          <button type="button" className="cost-explorer-chip-bar__clear" onClick={onClearExplorerContext}>
            Clear Explorer Context
          </button>
        ) : null}

        {onClearAll && chips.length > 0 ? (
          <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={onClearAll}>
            Clear Filters
          </button>
        ) : null}
      </div>
    </section>
  );
}
