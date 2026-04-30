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

## Explorer Network Cost Breakdown
- Placement
  - Drilldown under EC2 Explorer when:
    - Metric = Cost
    - Group By = Cost Category
    - Row = Network / Data Transfer
- Source of truth
  - Uses `fact_cost_line_items` for drilldown details.
  - Does not use `fact_ec2_instance_daily` for category-level network breakdown.
  - `fact_ec2_instance_daily` remains top-level explorer source.

- Categories
  - Internet Data Transfer
  - Inter-Region Data Transfer
  - Inter-AZ Data Transfer
  - NAT Gateway
  - Elastic IP
  - Load Balancer
  - Other Network

- Cost basis formulas
  - `effective = SUM(COALESCE(effective_cost, billed_cost, 0))`
  - `billed = SUM(COALESCE(billed_cost, 0))`
  - `list = SUM(COALESCE(list_cost, 0))` if used
  - `amortized = effective` fallback when no amortized field exists in this table

- Classification rules (V1)
  - Final evaluation order:
    1) NAT Gateway
    2) Elastic IP
    3) Load Balancer
    4) Internet Data Transfer (strict location-based)
    5) Inter-Region Data Transfer
    6) Inter-AZ Data Transfer
    7) Internet Data Transfer (text fallback)
    8) Other Network
  - NAT Gateway: usage/description contains `NatGateway`, `NATGateway`, `NAT-Gateway`, `NAT Gateway`
  - Elastic IP: contains `ElasticIP`, `Elastic IP`, `IdleAddress`, `InUseAddress`
  - Load Balancer: contains `LoadBalancer`, `Load Balancer`, `LCU`, `ALB`, `NLB`, `ELB`
  - Internet Data Transfer (strict): `from_location` or `to_location` contains `internet` or `external`
  - Inter-Region: requires both region codes present and different (`from_region_code != to_region_code`)
  - Inter-AZ: requires both region codes present and equal (`from_region_code = to_region_code`)
  - Internet Data Transfer (fallback): usage text contains `datatransfer-out` or `aws-out-bytes`
  - Other Network: remaining network-related costs
  - Note: classification is location/region-first. String matching is used as fallback only, to avoid over-classifying generic transfer lines as Internet.

- Metric formulas
  - `totalNetworkCost = SUM(cost_basis over network line items)`
  - `categoryCost = SUM(cost_basis where classifyNetworkCostType(lineItem) = category)`
  - `percent = (categoryCost / totalNetworkCost) * 100`
  - `Network Breakdown Usage = SUM(COALESCE(consumed_quantity, pricing_quantity, 0))` from `fact_cost_line_items`
  - Conversion rule: if DataTransfer usage unit sample indicates bytes, convert to GB using `/ (1024^3)`; if already GB, use as-is
  - `resourceCount = COUNT(DISTINCT resource_key)` within each category

- Network-related line-item filter
  - Include when any of:
    - `usage_type ILIKE '%DataTransfer%'`
    - `product_usage_type ILIKE '%DataTransfer%'`
    - `product_family ILIKE '%Data Transfer%'`
    - `line_item_description ILIKE '%Data Transfer%'`
    - `usage_type ILIKE '%NatGateway%' OR '%ElasticIP%' OR '%LoadBalancer%' OR '%LCU%'`
    - `operation ILIKE '%NatGateway%' OR '%LoadBalanc%'`

- Validation SQL examples
```sql
-- 1) Total network cost by effective basis from CUR line items
SELECT
  SUM(COALESCE(effective_cost, billed_cost, 0)) AS total_network_cost
FROM fact_cost_line_items
WHERE tenant_id = :tenant_id
  AND TO_DATE(CAST(usage_date_key AS text), 'YYYYMMDD') BETWEEN :from_date AND :to_date
  AND (
    LOWER(COALESCE(usage_type, '')) LIKE '%datatransfer%'
    OR LOWER(COALESCE(product_usage_type, '')) LIKE '%datatransfer%'
    OR LOWER(COALESCE(product_family, '')) LIKE '%data transfer%'
    OR LOWER(COALESCE(line_item_description, '')) LIKE '%data transfer%'
    OR LOWER(COALESCE(usage_type, '')) LIKE '%natgateway%'
    OR LOWER(COALESCE(usage_type, '')) LIKE '%elasticip%'
    OR LOWER(COALESCE(usage_type, '')) LIKE '%loadbalancer%'
    OR LOWER(COALESCE(usage_type, '')) LIKE '%lcu%'
    OR LOWER(COALESCE(operation, '')) LIKE '%natgateway%'
    OR LOWER(COALESCE(operation, '')) LIKE '%loadbalanc%'
  );
```

```sql
-- 2) Compare top-level explorer network rollup vs CUR drilldown total
SELECT
  SUM(COALESCE(data_transfer_cost, 0)) AS ec2_daily_network_total
FROM fact_ec2_instance_daily
WHERE tenant_id = :tenant_id
  AND usage_date BETWEEN :from_date AND :to_date;
```

```sql
-- 3) Sanity: no negative category costs expected in final response
-- (application clamps category costs to >= 0)
```

## Explorer Usage Metric -> Network Type
- Simplified usage group-by behavior
  - `Usage Category` group-by is removed.
  - Usage Metric = CPU:
    - Allowed group-by: Team, Product, Environment, Region, Account, Instance Type, Tag
  - Usage Metric = Network:
    - Allowed group-by: Network Type, Region, Account, Instance Type, Tag

- Trigger
  - Metric = Usage
  - Usage Metric = Network
  - Group By = Network Type

- Source table
  - `fact_cost_line_items`

- Classification
  - Uses the same `classifyNetworkCostType(lineItem)` helper as Network Cost.
  - Categories:
    - Internet Data Transfer
    - Inter-Region Data Transfer
    - Inter-AZ Data Transfer
    - NAT Gateway
    - Elastic IP
    - Load Balancer
    - Other Network

- Usage + percent formulas
  - `billed_usage = SUM(COALESCE(consumed_quantity, pricing_quantity, 0))`
  - `total_billed_usage = SUM(billed_usage across all network categories)`
  - `percent = billed_usage / total_billed_usage * 100`
  - Supporting cost field:
    - `cost = SUM(selected cost basis from fact_cost_line_items)`

- Table columns (Network Type group-by)
  - Network Type
  - Billed Usage (GB)
  - % of Network Usage
  - Network Cost ($)
  - Resource Count

- CloudWatch vs CUR note
  - Explorer Network Type usage is CUR billed usage from billing line items.
  - This can differ from CloudWatch Network Usage because CloudWatch reports telemetry usage metrics, while CUR reports billable quantities and billing dimensions.
