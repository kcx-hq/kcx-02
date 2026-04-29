# EC2 KPI Formulas (Instance Detail Corrected)

## Removed non-instance KPIs (not valid for single-instance detail)
- Previous Period Spend
- Savings Achieved
- Top Region
- Top Account
- Active Alerts

## Backend endpoint/service
- Endpoint: `GET /inventory/aws/ec2/instances/:instanceId/details`
- Backend service: `InstancesInventoryService.getInstanceDetails`
- Frontend page: `frontend/src/features/dashboard/pages/ec2/EC2InstanceDetailPage.tsx`

## Instance Detail Overview cards
- Total Cost
Meaning: Effective total cost for selected range.
Formula: `SUM(COALESCE(total_effective_cost, total_billed_cost, 0))`
Source table: `fact_ec2_instance_daily`
Source fields: `total_effective_cost`, `total_billed_cost`
Validation SQL:
```sql
SELECT SUM(COALESCE(total_effective_cost, total_billed_cost, 0)) AS total_cost
FROM fact_ec2_instance_daily
WHERE tenant_id = :tenant_id
  AND instance_id = :instance_id
  AND usage_date BETWEEN :from_date AND :to_date;
```
- Compute Cost
Meaning: Compute-only cost for instance.
Formula: `SUM(compute_cost)`
Source table/fields: `fact_ec2_instance_daily.compute_cost`
- Volume Cost
Meaning: EBS cost for instance.
Formula: `SUM(ebs_cost)` (fallback to attached volume summed cost when needed)
Source: `fact_ec2_instance_daily.ebs_cost`, fallback `fact_ebs_volume_daily.total_cost`
- Avg CPU
Meaning: Average CPU over selected range.
Formula: `AVG(cpu_avg)`
Source: `fact_ec2_instance_daily.cpu_avg`
- Network Usage
Meaning: Total in+out traffic.
Formula: `SUM(network_in_bytes) + SUM(network_out_bytes)`
Source: `fact_ec2_instance_daily.network_in_bytes`, `network_out_bytes`
- State / Instance Type / Pricing Type
Meaning: latest instance posture/identity.
Formula: latest inventory + latest normalized pricing
Source: `ec2_instance_inventory_snapshots`, `fact_ec2_instance_daily (reservation_type/pricing_model/is_spot)`

Insight banner posture rules:
- Idle: low CPU and low network
- Underutilized: low CPU
- Overutilized: high CPU
- Uncovered On-Demand: persisted `uncovered_on_demand` recommendation
- Healthy: none of above

Overview trends:
- Cost Trend: grouped by `usage_date` from `fact_ec2_instance_daily`
- CPU Trend: `cpu_avg` by `usage_date` from `fact_ec2_instance_daily`
- Network Trend: `(network_in_bytes + network_out_bytes)` by `usage_date` from `fact_ec2_instance_daily`
- Missing source handling: show `Needs backend source`

## Instance Detail Cost Breakdown
Meaning: cost composition by usage category.
Formula:
- `total = compute + ebs + network + other`
- `% = component / total * 100`
Rows:
- Compute = `SUM(compute_cost)`
- EBS = `SUM(ebs_cost)` or attached volume source fallback
- Network = `SUM(data_transfer_cost)`
- Other / Unallocated = `max(total - compute - ebs - network, 0)`
Total Cost basis:
- `SUM(COALESCE(total_effective_cost, total_billed_cost, 0))`
Source: `fact_ec2_instance_daily`, fallback `fact_ebs_volume_daily`
Validation SQL:
```sql
SELECT
  SUM(COALESCE(total_effective_cost, total_billed_cost, 0)) AS total,
  SUM(COALESCE(compute_cost, 0)) AS compute,
  SUM(COALESCE(ebs_cost, 0)) AS ebs,
  SUM(COALESCE(data_transfer_cost, 0)) AS network
FROM fact_ec2_instance_daily
WHERE tenant_id = :tenant_id
  AND instance_id = :instance_id
  AND usage_date BETWEEN :from_date AND :to_date;
```

## Instance Detail Usage tab
- Avg CPU (%)
Meaning: mean cpu.
Formula: `AVG(cpu_avg)`
Source: `fact_ec2_instance_daily.cpu_avg`
- Max CPU (%)
Formula: `MAX(cpu_max)`
Source: `fact_ec2_instance_daily.cpu_max`
- Network In (GB)
Formula: `SUM(network_in_bytes)`
Source: `fact_ec2_instance_daily.network_in_bytes`
- Network Out (GB)
Formula: `SUM(network_out_bytes)`
Source: `fact_ec2_instance_daily.network_out_bytes`
- Total Network Usage (GB)
Formula: `network_in + network_out`
- Network Cost ($)
Formula: `SUM(data_transfer_cost)`
Source: `fact_ec2_instance_daily.data_transfer_cost`
Charts:
- CPU Trend, Network Trend from backend facts
- If missing: `Needs backend source`

## Instance Detail Storage tab
Summary KPIs:
- Total Volume Cost
Formula: `SUM(total_cost)` by attached volume (selected instance/range)
Source: `fact_ebs_volume_daily.total_cost`
- Total Volume Size
Formula: `SUM(size_gb)`
Source: `ec2_volume_inventory_snapshots.size_gb`
- Volume Count
Formula: attached volume count
Source: `ec2_volume_inventory_snapshots`
Table fields:
- `volume_id`, `size_gb`, `volume_type`, `state`, `iops`, `throughput`, attached timestamp (`discovered_at`), `delete_on_termination` (if available)
Endpoint section: `attachedVolumes`
Navigation:
- `/dashboard/inventory/aws/ec2/volumes/{volumeId}` preserving query/date context

## Instance Detail Pricing & Efficiency tab
- Pricing Type
Meaning: normalized reservation/pricing posture.
Formula: latest normalized `reservation_type/pricing_model/is_spot`
- Coverage %
Formula: `covered_hours / total_hours * 100`
Source: `fact_ec2_instance_daily.covered_hours`, `total_hours`
- Compute Cost
Formula: `SUM(compute_cost)`
- Estimated Monthly Cost
Formula: current range cost shown (labelled as range cost when monthly normalization helper is unavailable)
- Potential Savings
Formula: persisted recommendation savings (max/selected recommendation value)
Source: `fact_recommendations.estimated_monthly_savings`
If unavailable: `Needs recommendation` / `$0`
Insight banner:
- On-Demand: RI/SP suggestion
- RI/SP covered: coverage confirmation
- Spot: spot detection

## Instance Detail Recommendations tab
Meaning: persisted optimization recommendations for this instance.
Source table: `fact_recommendations`
Source fields: `recommendation_type`, `recommendation_title`, `recommendation_text`, `idle_observation_value`, `estimated_monthly_savings`, `risk_level`, `status`
Filters: `tenant_id`, `resource_type='ec2_instance'`, `resource_id=:instance_id`, optional `cloud_connection_id`
Displayed columns:
- Type, Problem, Evidence, Action, Saving, Risk, Status
No fake row:
- Healthy fallback row removed
Empty state:
- `No optimization opportunities found for this instance.`

## Instance Detail Metadata tab
Meaning: authoritative instance identity/tags.
Source table: `ec2_instance_inventory_snapshots`
Source fields:
- Identity: `instance_id`, `availability_zone`, `launch_time`, account/region joins
- Tags: `tags_json`
Cards:
- Team, Product, Environment, Owner from instance tags (case-insensitive mapping)
Also show:
- Instance ID, Region, Account, Launch Time, Availability Zone, full tags table
Do not use attached volume tags.

## Missing backend data policy
- Any KPI/chart without real backend source must render: `Needs backend source`
- No synthetic or flat placeholder trend lines.
