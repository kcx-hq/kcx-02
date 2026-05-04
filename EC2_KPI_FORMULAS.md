# EC2 Business Logic and KPI Formulas (Canonical)

This document is the source of truth for EC2 business logic used across:
- Inventory: EC2 Instance Detail
- Explorer: Cost and Usage analysis
- Recommendations: instance and network optimization
- Dedicated EC2 Data Transfer page

## 1) Scope

Included domains:
- EC2 instance-level costs, usage, metadata, pricing posture
- Attached EBS storage rollups for instance detail
- Network cost/usage classification from CUR line items
- Recommendation generation and persisted recommendation display

Excluded from EC2 instance-detail KPIs:
- Cross-resource-only KPIs (e.g., Top Region, Top Account)
- Fabricated placeholders when backend source is missing

## 2) Global Data Sources

Primary tables:
- `fact_ec2_instance_daily`
- `fact_cost_line_items`
- `fact_ebs_volume_daily`
- `ec2_instance_inventory_snapshots`
- `ec2_volume_inventory_snapshots`
- `ec2_eip_inventory_snapshots`
- `fact_recommendations`

Primary identity filters:
- `tenant_id` (required)
- `instance_id` or `resource_id` when instance-scoped
- date range (`from_date`, `to_date`)
- optional `cloud_connection_id`

## 3) Global KPI Conventions

Cost basis precedence:
- effective: `COALESCE(total_effective_cost, total_billed_cost, 0)` for `fact_ec2_instance_daily`
- CUR line items: `COALESCE(effective_cost, billed_cost, 0)`

Null safety:
- All additive metrics use `COALESCE(metric, 0)`

Clamping:
- Displayed cost category values must not be negative
- Unallocated/other is `MAX(total - known_components, 0)`

Percent formula:
- `percent = part / whole * 100`
- if denominator is `0`, return `0` or `null` per UI contract (no divide-by-zero)

Time windows:
- Instance daily facts: `usage_date BETWEEN :from_date AND :to_date`
- CUR timestamp windows: `usage_start_time BETWEEN :from_date AND (:to_date::date + INTERVAL '1 day')` when timestamp-granular

## 4) EC2 Instance Detail: Overview KPIs

Endpoint/service:
- `GET /inventory/aws/ec2/instances/:instanceId/details`
- backend: `InstancesInventoryService.getInstanceDetails`
- frontend: `frontend/src/features/dashboard/pages/ec2/EC2InstanceDetailPage.tsx`

Cards:
- Total Cost:
  - `SUM(COALESCE(total_effective_cost, total_billed_cost, 0))`
  - source: `fact_ec2_instance_daily`
- Compute Cost:
  - `SUM(compute_cost)`
  - source: `fact_ec2_instance_daily`
- Volume Cost:
  - primary: `SUM(ebs_cost)` from `fact_ec2_instance_daily`
  - fallback: sum attached volume `total_cost` from `fact_ebs_volume_daily`
- Avg CPU:
  - `AVG(cpu_avg)`
- Network Usage:
  - `SUM(network_in_bytes) + SUM(network_out_bytes)`

Latest posture fields:
- State / Instance Type: latest from `ec2_instance_inventory_snapshots`
- Pricing Type: latest normalized from `reservation_type` / `pricing_model` / `is_spot`

Insight posture precedence:
1. `uncovered_on_demand` persisted recommendation exists -> Uncovered On-Demand
2. idle condition true -> Idle
3. underutilized condition true -> Underutilized
4. overutilized condition true -> Overutilized
5. else -> Healthy

Baseline posture thresholds:
- Idle: low CPU and low network
- Underutilized: low CPU
- Overutilized: high CPU

Overview trends (daily):
- Cost: by `usage_date`, metric `effective total`
- CPU: `cpu_avg` by `usage_date`
- Network: `(network_in_bytes + network_out_bytes)` by `usage_date`

Missing source policy:
- if unavailable from backend: render `Needs backend source`

## 5) EC2 Instance Detail: Cost Breakdown

Composition:
- `total = compute + ebs + network + other`
- compute: `SUM(compute_cost)`
- ebs: `SUM(ebs_cost)` with volume fallback when needed
- network: `SUM(data_transfer_cost)`
- other: `MAX(total_effective - compute - ebs - network, 0)`
- total_effective: `SUM(COALESCE(total_effective_cost, total_billed_cost, 0))`

Percent by component:
- `component_percent = component_cost / total_effective * 100`

## 6) EC2 Instance Detail: Usage Tab

KPIs:
- Avg CPU (%): `AVG(cpu_avg)`
- Max CPU (%): `MAX(cpu_max)`
- Network In: `SUM(network_in_bytes)` (UI may convert to GB)
- Network Out: `SUM(network_out_bytes)` (UI may convert to GB)
- Total Network Usage: `network_in + network_out`
- Network Cost ($): `SUM(data_transfer_cost)`

Charts:
- CPU trend and network trend from backend facts
- no synthetic trend lines

## 7) EC2 Instance Detail: Storage Tab

Summary:
- Total Volume Cost: `SUM(total_cost)` for attached volumes in range
- Total Volume Size: `SUM(size_gb)`
- Volume Count: count attached volumes

Sources:
- cost: `fact_ebs_volume_daily.total_cost`
- inventory: `ec2_volume_inventory_snapshots`

Volume table fields:
- `volume_id`, `size_gb`, `volume_type`, `state`, `iops`, `throughput`, `discovered_at`, `delete_on_termination` (if present)

Navigation:
- `/dashboard/inventory/aws/ec2/volumes/{volumeId}` with query/date context preserved

## 8) EC2 Instance Detail: Pricing and Efficiency Tab

Metrics:
- Pricing Type: normalized latest reservation/pricing posture
- Coverage %: `covered_hours / total_hours * 100`
- Compute Cost: `SUM(compute_cost)`
- Estimated Monthly Cost:
  - use monthly-normalized helper when available
  - otherwise label as selected range cost
- Potential Savings:
  - persisted recommendation savings (selected/max applicable value)
  - source: `fact_recommendations.estimated_monthly_savings`
  - fallback: `$0` / missing recommendation state

Pricing insight banner:
- On-Demand: recommend RI/SP where eligible
- RI/SP covered: show coverage confirmation
- Spot: spot posture indicator

## 9) EC2 Instance Detail: Recommendations Tab

Source:
- `fact_recommendations`

Filter:
- `tenant_id = :tenant_id`
- `resource_type = 'ec2_instance'`
- `resource_id = :instance_id`
- optional `cloud_connection_id`

Display columns:
- Type, Problem, Evidence, Action, Saving, Risk, Status

Behavior:
- No fake "healthy" row
- Empty state text: `No optimization opportunities found for this instance.`

## 10) EC2 Instance Detail: Metadata Tab

Authoritative source:
- `ec2_instance_inventory_snapshots`

Fields:
- Identity: `instance_id`, `availability_zone`, `launch_time`, region/account joins
- Tags: `tags_json`

Derived cards from tags (case-insensitive key mapping):
- Team, Product, Environment, Owner

Also display:
- Instance ID, Region, Account, Launch Time, Availability Zone, complete tags table

Rule:
- Do not use attached volume tags for instance metadata cards

## 11) Network Classification (Shared Logic)

Shared helper:
- `classifyNetworkCostType(lineItem)`

Final evaluation order:
1. NAT Gateway
2. Elastic IP
3. Load Balancer
4. Internet Data Transfer (strict location-based)
5. Inter-Region Data Transfer
6. Inter-AZ Data Transfer
7. Internet Data Transfer (text fallback)
8. Other Network

Matching rules:
- NAT Gateway: contains `NatGateway`, `NATGateway`, `NAT-Gateway`, `NAT Gateway`
- Elastic IP: contains `ElasticIP`, `Elastic IP`, `IdleAddress`, `InUseAddress`
- Load Balancer: contains `LoadBalancer`, `Load Balancer`, `LCU`, `ALB`, `NLB`, `ELB`
- Internet strict: `from_location` or `to_location` indicates internet/external
- Inter-Region: both region codes exist and differ
- Inter-AZ: both region codes exist and equal (with AZ transfer signal)
- Internet fallback: transfer-out text pattern fallback
- Else: Other Network

Design rule:
- Prefer location/region evidence first, text fallback second

## 12) EC2 Network Recommendations

Important distinction:
- Cost recommendations: CUR (`fact_cost_line_items`)
- Usage behavior: CloudWatch-derived daily facts (`fact_ec2_instance_daily`)
- Values can differ due to billing vs telemetry semantics

Recommendation types:

1. `high_internet_data_transfer`
- Condition: internet transfer and (`cost >= 10` OR `%network >= 30` OR `usage_gb >= 50`)
- Savings: `internet_transfer_cost * 0.30`
- Risk/Effort: low/medium

2. `high_inter_region_data_transfer`
- Condition: inter-region and (`cost >= 5` OR `%network >= 20` OR `usage_gb >= 25`)
- Savings: `inter_region_cost * 0.40`
- Risk/Effort: medium/medium

3. `high_inter_az_data_transfer`
- Condition: inter-AZ and (`cost >= 5` OR `%network >= 20` OR `usage_gb >= 25`)
- Savings: `inter_az_cost * 0.25`
- Risk/Effort: medium/medium

4. `low_cpu_high_network`
- Condition: `avg_cpu < 5` AND `total_network_usage_gb >= 10` AND `total_effective_cost >= 5` AND running
- Savings: `total_effective_cost * 0.20`
- Risk/Effort: medium/medium

5. `high_nat_gateway_cost`
- Condition: NAT Gateway and (`cost >= 10` OR `%network >= 20`)
- Savings: `nat_gateway_cost * 0.30`
- Risk/Effort: medium/medium

6. `unattached_elastic_ip`
- Condition: unattached/unassociated EIP inventory state
- Savings: actual EIP cost if present, else `3.60`
- Risk/Effort: low/low

## 13) EC2 Explorer: Network Cost Breakdown

Placement:
- When Metric = Cost, Group By = Cost Category, category row = Network/Data Transfer

Source of truth:
- Drilldown details from `fact_cost_line_items`
- Top-level explorer may continue using `fact_ec2_instance_daily`

Categories:
- Internet Data Transfer
- Inter-Region Data Transfer
- Inter-AZ Data Transfer
- NAT Gateway
- Elastic IP
- Load Balancer
- Other Network

Cost basis formulas:
- effective: `SUM(COALESCE(effective_cost, billed_cost, 0))`
- billed: `SUM(COALESCE(billed_cost, 0))`
- list: `SUM(COALESCE(list_cost, 0))` (if used)
- amortized: fallback to effective when absent

Usage and counts:
- usage: `SUM(COALESCE(consumed_quantity, pricing_quantity, 0))`
- bytes->GB conversion when unit indicates bytes: `/ (1024^3)`
- resource count: `COUNT(DISTINCT resource_key)`

Percent:
- `categoryCost / totalNetworkCost * 100`

Network line-item inclusion filter (any match):
- data transfer patterns (`usage_type`, `product_usage_type`, `product_family`, description)
- nat/elasticip/lb/lcu operation or usage hints

## 14) EC2 Explorer: Usage Metric -> Network Type

Behavior:
- Usage Category group-by removed
- Usage Metric = CPU -> group-by: Team, Product, Environment, Region, Account, Instance Type, Tag
- Usage Metric = Network -> group-by includes Network Type (plus Region/Account/Instance Type/Tag)

Trigger:
- Metric = Usage, Usage Metric = Network, Group By = Network Type

Source:
- `fact_cost_line_items`

Classification:
- same shared `classifyNetworkCostType(lineItem)` categories/order

Formulas:
- `billed_usage = SUM(COALESCE(consumed_quantity, pricing_quantity, 0))`
- `%network_usage = billed_usage / total_billed_usage * 100`
- supporting cost: `SUM(selected cost basis)`

Table columns:
- Network Type, Billed Usage (GB), % of Network Usage, Network Cost ($), Resource Count

## 15) Dedicated EC2 Data Transfer Page

Route/API:
- frontend: `/dashboard/ec2/network/data-transfer`
- backend: `GET /api/ec2/data-transfer`

Independence rule:
- Must not depend on Explorer network-breakdown endpoint/types/components

Required query params:
- `startDate`, `endDate`, `accountId`, `region`, `team`, `product`, `environment`
- `tagKey`, `tagValue`, `transferType`
- `minCost`, `maxCost`, `minUsageGb`, `maxUsageGb`
- `resourceId`, `search`

Searchable fields:
- `resourceId`, `resourceName`, `accountName`, `region`, `team`, `product`

Included rows:
- transfer-related CUR lines only

Explicit exclusions:
- NAT Gateway, Elastic IP, Load Balancer, EBS, Snapshot, Compute

Transfer type enum:
- `internet`, `inter_region`, `inter_az`, `unknown`

Transfer type inference:
- use normalized blob from usage/product/operation/description/location fields
- apply exclusion-first for NAT patterns
- then infer internet/inter-region/inter-AZ/unknown

Cost/usage formulas:
- `cost = SUM(COALESCE(effective_cost, billed_cost, 0))`
- `usage_gb = SUM(COALESCE(consumed_quantity, pricing_quantity, 0))` normalized to GB if bytes

Summary formulas:
- `totalCost = SUM(row.cost)`
- `totalUsageGb = SUM(row.usageGb)`
- `resourceCount = COUNT(DISTINCT resourceId where not null)`
- per-type costs: internet/inter_region/inter_az/unknown
- `potentialSavings = internet*0.20 + inter_region*0.30 + inter_az*0.25 + unknown*0.10`

Row formulas:
- `costTrendPct = (current - previous) / previous * 100` (null when previous unavailable/0)
- `estimatedSavings` by transfer type multiplier
- confidence:
  - high: strong location/region evidence
  - medium: clear text evidence
  - low: unknown/weak evidence

Sorting/pagination:
- sort keys: `cost`, `usageGb`, `resourceId`, `region`, `transferType`, `estimatedSavings`, `lastSeen`
- default: `cost desc`

Integrity rule:
- `summary.totalCost` equals sum of filtered row costs (rounding tolerance)

Navigation:
- from explorer data-transfer category click -> this page with scoped filters
- row resource link:
  - with instance-like id: `/dashboard/inventory/aws/ec2/instances/{resourceId}`
  - otherwise display `Unmapped`
- recommendation links follow resource-aware vs aggregate query pattern

## 16) Missing Backend Data Policy

Hard rules:
- No synthetic KPI values
- No fabricated trend lines
- Show `Needs backend source` when source missing
- Recommendation tables show true empty state when no data

## 17) Validation SQL Templates

Total instance cost:
```sql
SELECT SUM(COALESCE(total_effective_cost, total_billed_cost, 0)) AS total_cost
FROM fact_ec2_instance_daily
WHERE tenant_id = :tenant_id
  AND instance_id = :instance_id
  AND usage_date BETWEEN :from_date AND :to_date;
```

Instance cost components:
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

CUR total network cost:
```sql
SELECT SUM(COALESCE(effective_cost, billed_cost, 0)) AS total_network_cost
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

Explorer top-level network check:
```sql
SELECT SUM(COALESCE(data_transfer_cost, 0)) AS ec2_daily_network_total
FROM fact_ec2_instance_daily
WHERE tenant_id = :tenant_id
  AND usage_date BETWEEN :from_date AND :to_date;
```

## 18) Non-Applicable KPIs for Instance Detail

These are intentionally excluded from single-instance detail cards:
- Previous Period Spend
- Savings Achieved
- Top Region
- Top Account
- Active Alerts
