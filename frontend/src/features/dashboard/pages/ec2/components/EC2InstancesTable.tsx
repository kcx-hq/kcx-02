import type { InventoryEc2InstanceRow } from "@/features/client-home/api/inventory-instances.api";
import { EmptyStateBlock } from "@/features/dashboard/common/components/EmptyStateBlock";

type EC2InstancesTableProps = {
  rows: InventoryEc2InstanceRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
};

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return CURRENCY_FORMATTER.format(value);
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "-";
  return DATE_TIME_FORMATTER.format(new Date(parsed));
};

const getReservationType = (value: InventoryEc2InstanceRow["pricingType"]): string => {
  if (value === "on_demand") return "On-Demand";
  if (value === "savings_plan") return "Savings Plan";
  if (value === "reserved") return "Reserved";
  if (value === "spot") return "Spot";
  return "-";
};

const toTitle = (value: string | null): string => {
  if (!value) return "-";
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getRecommendation = (instance: InventoryEc2InstanceRow): string => {
  if (instance.isIdleCandidate) return "Idle: Stop or downsize";
  if (instance.isOverutilizedCandidate) return "Overutilized: Rightsize up";
  if (instance.isUnderutilizedCandidate) return "Underutilized: Rightsize down";
  return "Healthy";
};

export function EC2InstancesTable({ rows, loading, error, onRetry }: EC2InstancesTableProps) {
  if (loading) {
    return <div className="ec2-explorer-table__skeleton" aria-hidden="true" />;
  }

  if (error) {
    return (
      <EmptyStateBlock
        title="Unable to load instances"
        message={error.message || "An unexpected error occurred."}
        actions={
          <button type="button" className="cost-explorer-state-btn" onClick={onRetry}>
            Retry
          </button>
        }
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyStateBlock
        title="No instances found"
        message="No EC2 instances match the active filters. Try resetting some filters."
      />
    );
  }

  return (
    <section className="ec2-explorer-table ec2-instances-table" aria-label="EC2 instances table">
      <div className="ec2-explorer-table__scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Instance</th>
              <th scope="col">Total Cost</th>
              <th scope="col">CPU %</th>
              <th scope="col">Network</th>
              <th scope="col">Volume Cost</th>
              <th scope="col">State</th>
              <th scope="col">Instance Type</th>
              <th scope="col">Reservation Type</th>
              <th scope="col">Region</th>
              <th scope="col">Launch Time</th>
              <th scope="col">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((instance) => (
              <tr key={instance.instanceId}>
                <td>
                  <div className="ec2-instances-table__instance-cell">
                    <strong>{instance.instanceName ?? instance.instanceId}</strong>
                    <span>{instance.instanceId}</span>
                  </div>
                </td>
                <td>{formatCurrency(instance.monthToDateCost)}</td>
                <td>{formatPercent(instance.cpuAvg)}</td>
                <td>-</td>
                <td>-</td>
                <td>{toTitle(instance.state)}</td>
                <td>{instance.instanceType ?? "-"}</td>
                <td>{getReservationType(instance.pricingType)}</td>
                <td>{instance.regionName ?? instance.regionId ?? instance.regionKey ?? "-"}</td>
                <td>{formatDateTime(instance.launchTime)}</td>
                <td>{getRecommendation(instance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
