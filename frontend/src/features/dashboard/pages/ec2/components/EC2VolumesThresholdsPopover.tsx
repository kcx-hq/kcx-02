import type { EC2VolumesThresholds } from "./ec2Volumes.types";

type EC2VolumesThresholdsPopoverProps = {
  value: EC2VolumesThresholds;
  onChange: (next: EC2VolumesThresholds) => void;
};

export function EC2VolumesThresholdsPopover({ value, onChange }: EC2VolumesThresholdsPopoverProps) {
  const update = (key: keyof EC2VolumesThresholds, nextValue: string) => {
    onChange({
      ...value,
      [key]: nextValue,
    });
  };

  return (
    <div className="ec2-explorer-thresholds" role="dialog" aria-label="Volume threshold filters">
      <p className="ec2-explorer-thresholds__title">Thresholds</p>
      <div className="ec2-explorer-thresholds__grid">
        <label className="ec2-explorer-thresholds__field">
          <span>Cost min</span>
          <input value={value.costMin} onChange={(event) => update("costMin", event.target.value)} />
        </label>
        <label className="ec2-explorer-thresholds__field">
          <span>Cost max</span>
          <input value={value.costMax} onChange={(event) => update("costMax", event.target.value)} />
        </label>
        <label className="ec2-explorer-thresholds__field">
          <span>Size min (GB)</span>
          <input value={value.sizeMin} onChange={(event) => update("sizeMin", event.target.value)} />
        </label>
        <label className="ec2-explorer-thresholds__field">
          <span>Size max (GB)</span>
          <input value={value.sizeMax} onChange={(event) => update("sizeMax", event.target.value)} />
        </label>
      </div>
    </div>
  );
}
