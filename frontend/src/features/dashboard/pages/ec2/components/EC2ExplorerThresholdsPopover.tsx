import type { EC2Thresholds } from "../ec2ExplorerControls.types";

type EC2ExplorerThresholdsPopoverProps = {
  value: EC2Thresholds;
  onChange: (next: EC2Thresholds) => void;
};

export function EC2ExplorerThresholdsPopover({ value, onChange }: EC2ExplorerThresholdsPopoverProps) {
  const update = (key: keyof EC2Thresholds, nextValue: string) => {
    onChange({
      ...value,
      [key]: nextValue,
    });
  };

  return (
    <div className="ec2-explorer-thresholds" role="dialog" aria-label="Threshold filters">
      <p className="ec2-explorer-thresholds__title">Thresholds</p>
      <div className="ec2-explorer-thresholds__grid">
        <label className="ec2-explorer-thresholds__field">
          <span>CPU min</span>
          <input value={value.cpuMin} onChange={(event) => update("cpuMin", event.target.value)} />
        </label>
        <label className="ec2-explorer-thresholds__field">
          <span>CPU max</span>
          <input value={value.cpuMax} onChange={(event) => update("cpuMax", event.target.value)} />
        </label>
        <label className="ec2-explorer-thresholds__field">
          <span>Cost min</span>
          <input value={value.costMin} onChange={(event) => update("costMin", event.target.value)} />
        </label>
        <label className="ec2-explorer-thresholds__field">
          <span>Cost max</span>
          <input value={value.costMax} onChange={(event) => update("costMax", event.target.value)} />
        </label>
        <label className="ec2-explorer-thresholds__field">
          <span>Network min</span>
          <input value={value.networkMin} onChange={(event) => update("networkMin", event.target.value)} />
        </label>
        <label className="ec2-explorer-thresholds__field">
          <span>Network max</span>
          <input value={value.networkMax} onChange={(event) => update("networkMax", event.target.value)} />
        </label>
      </div>
    </div>
  );
}
