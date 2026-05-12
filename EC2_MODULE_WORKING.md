# EC2 Module Working

## 1) EC2 Module Overview

### Purpose
The EC2 module gives users a single place to:
- see EC2 instance and EBS volume cost/usage trends,
- investigate resource-level cost drivers,
- inspect instance/volume/snapshot inventory,
- view and act on optimization recommendations.

It is implemented across:
- Backend APIs/services: `backend/src/features/ec2`, `backend/src/features/inventory/aws/ec2`, `backend/src/features/ec2/optimization`
- Frontend pages: `frontend/src/features/dashboard/pages/ec2/*`

### User flow
Explorer -> Instance List -> Instance Detail -> Volume List -> Volume Detail -> Recommendations

Main page paths:
- Explorer: `frontend/src/features/dashboard/pages/ec2/EC2ExplorerPage.tsx`
- Instance List: `frontend/src/features/dashboard/pages/ec2/EC2InstancesPage.tsx`
- Instance Detail: `frontend/src/features/dashboard/pages/ec2/EC2InstanceDetailPage.tsx`
- Volume List: `frontend/src/features/dashboard/pages/ec2/EC2VolumesPage.tsx`
- Volume Detail: `frontend/src/features/dashboard/pages/ec2/EC2VolumeDetailPage.tsx`
- Recommendations: `frontend/src/features/dashboard/pages/ec2/EC2OptimizationPage.tsx`

---

## 2) Data Flow

### End-to-end flow
1. **Ingestion / sync sources**
- AWS inventory + CloudWatch metrics jobs populate inventory/utilization tables.
- Billing ingestion populates CUR-like fact/dimension tables.
- EC2 rollup jobs populate EC2 daily fact tables.

Key backend job area:
- `backend/src/features/ec2/scheduled-jobs/handlers/*`

2. **Storage in fact/dimension/inventory tables**
- EC2 daily facts: `fact_ec2_instance_daily`, `fact_ebs_volume_daily`
- Utilization series: `ec2_instance_utilization_daily/hourly`, `ebs_volume_utilization_daily/hourly`
- Inventory snapshots: `ec2_instance_inventory_snapshots`, `ec2_volume_inventory_snapshots`, `ec2_snapshot_inventory_snapshots`
- Billing facts/dims: `fact_cost_line_items`, `dim_resource`, `dim_region`, `dim_sub_account`, `dim_billing_account`
- Recommendations persistence: `fact_recommendations`

3. **API query layer**
- Explorer reads `fact_ec2_instance_daily` (+ dims/tags)
- Instance list/detail reads inventory snapshots + `fact_ec2_instance_daily`
- Volume list/detail reads inventory snapshots + `fact_ebs_volume_daily` + `ebs_volume_utilization_daily`
- Snapshot list reads inventory snapshots + `fact_cost_line_items` via `dim_resource`
- Recommendation refresh reads candidates from instance/volume/snapshot tables and upserts into `fact_recommendations`

4. **Frontend consumption**
- Dashboard API wrappers: `frontend/src/features/dashboard/api/dashboardApi.ts`
- Inventory API wrappers: `frontend/src/features/client-home/api/inventory-*.api.ts`
- React Query hooks wire pages to APIs.

---

## 3) Database Tables Used

| Table | Purpose | Important fields | Used in | Relationships |
|---|---|---|---|---|
| `fact_ec2_instance_daily` | Core EC2 daily rollup (cost + usage + recommendation flags) | `usage_date`, `instance_id`, `compute_cost`, `ebs_cost`, `data_transfer_cost`, `total_effective_cost`, `total_billed_cost`, `cpu_avg`, `cpu_max`, `network_in_bytes`, `network_out_bytes`, `state`, `reservation_type`, `covered_hours`, `uncovered_hours`, `is_idle_candidate`, `is_underutilized_candidate`, `is_overutilized_candidate`, `region_key`, `sub_account_key`, `resource_key`, `cloud_connection_id`, `billing_source_id` | Explorer, Instance List metrics, recommendation generation | Joins to `dim_region`, `dim_sub_account`; tags joined through inventory snapshots |
| `fact_ec2_instance_cost_daily` | Cost-focused daily EC2 fact | `compute_cost`, `ebs_cost`, `total_billed_cost`, `total_effective_cost` | Supporting EC2 cost rollups (not primary read path in current UI) | Same dimensional keys as instance facts |
| `fact_ec2_instance_coverage_daily` | RI/SP coverage-focused daily fact | `reservation_type`, `covered_hours`, `uncovered_hours`, `covered_cost`, `uncovered_cost` | Coverage recommendation support | Same dimensional keys as instance facts |
| `ec2_instance_inventory_snapshots` | Latest discovered EC2 inventory state | `instance_id`, `instance_type`, `state`, `launch_time`, `availability_zone`, `region_key`, `sub_account_key`, `tags_json`, `metadata_json`, `is_current`, `cloud_connection_id` | Explorer tags, Instance List fields, Instance Detail, Volume attachment enrichment | Linked by `instance_id` (+ `cloud_connection_id` best effort) |
| `ec2_instance_utilization_daily` | Daily instance performance metrics | `cpu_avg/max/min`, `network_*`, `disk_*`, `ebs_*`, candidate flags | Instance performance API | Linked by `instance_id` |
| `ec2_instance_utilization_hourly` | Hourly instance performance metrics | same metric family as daily | Instance performance API (hourly mode) | Linked by `instance_id` |
| `fact_ebs_volume_daily` | Daily EBS rollup incl. optimization signals | `volume_id`, `total_cost`, `storage_cost`, `is_unattached`, `is_attached_to_stopped_instance`, `is_idle_candidate`, `is_underutilized_candidate`, `optimization_status`, `attached_instance_id` | Volume list summary + recommendation candidates | Joins to volume inventory; dimensional keys to region/account/resource |
| `ec2_volume_inventory_snapshots` | Latest EBS inventory state | `volume_id`, `volume_type`, `size_gb`, `iops`, `throughput`, `state`, `is_attached`, `attached_instance_id`, `tags_json`, `metadata_json`, `is_current` | Volume list/detail, snapshot source-volume name resolution | Linked by `volume_id` |
| `ebs_volume_utilization_daily` | Daily EBS utilization metrics | `read_bytes`, `write_bytes`, `read_ops`, `write_ops`, `queue_length_max`, `burst_balance_avg`, `idle_time_avg`, candidate flags | Volume performance + optimization status calculation | Linked by `volume_id` |
| `ebs_volume_utilization_hourly` | Hourly EBS utilization metrics | same metric family as daily | Volume performance API (hourly mode) | Linked by `volume_id` |
| `ec2_snapshot_inventory_snapshots` | Latest snapshot inventory | `snapshot_id`, `source_volume_id`, `source_instance_id`, `start_time`, `state`, `storage_tier`, `tags_json`, `is_current` | Snapshot inventory + recommendation candidates | Linked to source volume/instance by IDs |
| `fact_cost_line_items` | Billing line item fact used for snapshot costs and recommendation costing | `resource_key`, `usage_date_key`, `billed_cost`, `effective_cost`, `list_cost`, `billing_source_id` | Snapshot cost computation, snapshot rec candidate cost | Joins through `dim_resource`, `dim_date`, optional `dim_billing_account` |
| `dim_resource` | Resource dimension (id, type, name) | `id`, `resource_id`, `resource_type` | Snapshot cost joins (`resource_type='ec2_snapshot'`) | `fact_cost_line_items.resource_key -> dim_resource.id` |
| `dim_region` | Region dimension | `id`, `region_id`, `region_name`, `availability_zone` | Explorer/instance/volume region labels | Joined via `region_key` |
| `dim_sub_account` | Account/sub-account dimension | `id`, `sub_account_id`, `sub_account_name` | Explorer/instance/volume account labels | Joined via `sub_account_key` |
| `dim_billing_account` | Billing account + currency dimension | `id`, `billing_currency` | Snapshot cost currency safety checks | Joined from aggregated billing-account key |
| `fact_recommendations` | Persisted recommendations and lifecycle state | `category`, `recommendation_type`, `resource_type`, `resource_id`, `estimated_monthly_savings`, `status`, `risk_level`, `effort_level`, `metadata_json`, `detected_at`, `last_seen_at`, `source_system` | EC2 recommendations page and optimization summary | Joined optionally to dims for labels |
| `billing_sources` | Billing source metadata | `id`, `tenant_id`, `cloud_connection_id`, `source_type` | Scope/filtering and recommendation candidate scoping | Linked by `billing_source_id` in facts |
| `cloud_connections` | Cloud connection metadata | `id`, `tenant_id`, `status`, account/export fields | Scope/filtering and recommendation candidate scoping | Linked by `cloud_connection_id` |
| `ec2_cost_history_daily`, `ec2_cost_history_monthly` | EC2 historical cost snapshots | `month_start`, `usage_date`, charge/pricing categories, costs | Not used directly by listed EC2 UI pages in current code | Historical/reporting support |

Needs verification:
- Any UI section claiming direct use of `ec2_cost_history_*` in current EC2 pages.

---

## 4) EC2 Explorer Page

Files:
- Frontend page: `frontend/src/features/dashboard/pages/ec2/EC2ExplorerPage.tsx`
- Summary cards: `frontend/src/features/dashboard/pages/ec2/components/EC2SummaryCards.tsx`
- Backend API: `backend/src/features/ec2/explorer/*`

### KPI definitions

| Meaning | Formula | Tables | Fields | Used In |
|---|---|---|---|---|
| Total Cost | `SUM(costBasis(row))` over filtered rows | `fact_ec2_instance_daily` | `total_effective_cost` or `total_billed_cost` | Explorer summary |
| Compute Cost | `SUM(compute_cost)` | `fact_ec2_instance_daily` | `compute_cost` | Explorer cost table/graph |
| Volume Cost (EBS) | `SUM(ebs_cost)` | `fact_ec2_instance_daily` | `ebs_cost` | Explorer cost table/graph |
| Instance Count | distinct instance IDs in filtered rows | `fact_ec2_instance_daily` | `instance_id` | Explorer summary |
| Avg CPU | arithmetic mean of `cpu_avg` across filtered rows | `fact_ec2_instance_daily` | `cpu_avg` | Explorer summary |
| Network | `SUM((network_in_bytes+network_out_bytes)/GB)` | `fact_ec2_instance_daily` | `network_in_bytes`, `network_out_bytes` | Explorer summary |
| Idle Instances | rows with `is_idle_candidate=true` when condition applied | `fact_ec2_instance_daily` | `is_idle_candidate` | Explorer filter `condition=idle` |
| Underutilized Instances | rows with `is_underutilized_candidate=true` | `fact_ec2_instance_daily` | `is_underutilized_candidate` | Explorer filter `condition=underutilized` |
| Overutilized Instances | rows with `is_overutilized_candidate=true` | `fact_ec2_instance_daily` | `is_overutilized_candidate` | Explorer filter `condition=overutilized` |
| Uncovered On-Demand Instances | reservation type normalized to `on_demand` | `fact_ec2_instance_daily` | `reservation_type`, `pricing_model` fallback | Explorer filter `condition=uncovered` |
| Unattached Volumes | **Not computed in Explorer API response** | N/A | N/A | Needs verification |

Notes:
- Snapshot/EIP additional daily cost is currently placeholder zero-filled in backend: `getAdditionalDailyCosts()` in `backend/src/features/ec2/explorer/ec2-explorer.query.ts`.
- Group by `usage_category` exists in frontend type, but backend schema supports `cost_category` only. Needs verification.

### Filters and group-by applied
- Scope and date filter: backend `toScopeWhereClauses()` in `ec2-explorer.query.ts`
- Optional filters: regions, parsed tags (`tags` query), states, instanceTypes, thresholds (`min/maxCost`, `min/maxCpu`, `min/maxNetwork`)
- Group-by options in backend: `none`, `region`, `instance_type`, `reservation_type`, `cost_category`, `tag`

---

## 5) Instance List Page

Files:
- Page: `frontend/src/features/dashboard/pages/ec2/EC2InstancesPage.tsx`
- Table: `frontend/src/features/dashboard/pages/ec2/components/EC2InstancesTable.tsx`
- Backend API: `GET /inventory/aws/ec2/instances` (`instances-inventory.service.ts`)

### Filters
- Frontend controls: condition, state, instanceType, reservationType, search, thresholds, region/tags chips.
- Backend query supports: `cloudConnectionId`, `subAccountKey`, `state`, `region`, `instanceType`, `pricingType`, `search`, `startDate`, `endDate`, pagination.

### Columns mapping

| Column | Calculation | Source table/field |
|---|---|---|
| Instance | `instanceName` + `instanceId` | `ec2_instance_inventory_snapshots.tags_json->Name`, `instance_id` |
| Total Cost | frontend uses `monthToDateCost` (currently equals compute cost payload) | backend maps from `fact_ec2_instance_daily` aggregate `SUM(compute_cost)` into both `computeCost` and `monthToDateCost` |
| Compute Cost | `computeCost` | `fact_ec2_instance_daily.compute_cost` aggregate |
| Volume Cost | sum by instance from volumes API (`mtdCost`) | `fact_ebs_volume_daily.total_cost` through volumes endpoint |
| Volume Count | `attachedVolumeCount` | count from `ec2_volume_inventory_snapshots` (`is_attached=true`) |
| Attached Volume Size | `attachedVolumeTotalSizeGb` | sum `ec2_volume_inventory_snapshots.size_gb` |
| CPU % | `cpuAvg` | avg from `fact_ec2_instance_daily.cpu_avg` |
| Network | `monthToDateCost - computeCost - volumeCost` (frontend estimate) | Derived in frontend, not direct DB field |
| State | inventory state | `ec2_instance_inventory_snapshots.state` |
| Instance Type | inventory instance type | `ec2_instance_inventory_snapshots.instance_type` |
| Reservation Type | normalized pricing type | `fact_ec2_instance_daily.reservation_type/pricing_model/is_spot` |
| Region | dim label | `dim_region.region_name/region_id` via `region_key` |
| Launch Time | inventory launch time | `ec2_instance_inventory_snapshots.launch_time` |
| Recommendation | UI label from candidate flags | `is_idle_candidate`, `is_underutilized_candidate`, `is_overutilized_candidate` |

### Row click behavior
- Row click -> `/dashboard/inventory/aws/ec2/instances/:instanceId` (Instance Detail)
- Volume count/cost cells click -> `/dashboard/inventory/aws/ec2/volumes?attachedInstanceId=:instanceId`

Needs verification:
- "Total Cost" naming vs backend value (currently same as compute MTD in payload).

---

## 6) Instance Detail Page

File: `frontend/src/features/dashboard/pages/ec2/EC2InstanceDetailPage.tsx`

Important: this page is mostly composed from list APIs plus frontend-derived values.

### Tabs

1. **Overview**
- Purpose: quick posture summary for selected instance.
- Data: selected instance row + attached volume rows.
- KPIs: Total Spend, Previous Period Spend (derived), Savings Achieved (derived from local rule), region/account/alerts.
- Source: instance + volume APIs; many values computed in component.

2. **Cost Breakdown**
- Sections: usage-type breakdown table + daily trend line.
- Formula: `compute`, `ebs(volume sum)`, `network=max(total-compute-ebs,0)`, `other=remaining`.
- Source: frontend-derived from instance and volume list values.

3. **Usage**
- Sections: CPU/Network cards + trends.
- Source: mostly flat synthetic trend generated in UI (`buildFlatTrend`).
- Needs verification for production-grade trend source.

4. **Storage**
- Sections: attached volume summary + table.
- Source: volumes list endpoint.
- Navigation: row -> Volume Detail page.

5. **Pricing & Efficiency**
- Purpose: pricing type + potential saving message.
- Source: `pricingType`, `computeCost`, local recommendation heuristic.

6. **Recommendations**
- Purpose: one-row local recommendation summary.
- Source: local `toRecommendationStatus()` function, not persisted `fact_recommendations`.

7. **Metadata**
- Purpose: tag/metadata display.
- Source: reads tags from first attached volume row.
- Needs verification (instance tags should likely come from instance inventory, not volume tags).

---

## 7) Volume List Page

Files:
- Page: `frontend/src/features/dashboard/pages/ec2/EC2VolumesPage.tsx`
- Backend: `backend/src/features/inventory/aws/ec2/volumes/volumes-inventory.service.ts`

### Filters
- State, volumeType, attachment, region, search, thresholds (cost/size), optional attachedInstanceId from navigation context.

### Columns mapping

| Column | Calculation | Source table/field |
|---|---|---|
| Volume | `volumeName` + `volumeId` | `ec2_volume_inventory_snapshots.tags_json->Name`, `volume_id` |
| Cost | `mtdCost` | `SUM(fact_ebs_volume_daily.total_cost)` in date range |
| Size | `sizeGb` | `ec2_volume_inventory_snapshots.size_gb` |
| Type | `volumeType` | `ec2_volume_inventory_snapshots.volume_type` |
| State | `state` | `ec2_volume_inventory_snapshots.state` |
| Attachment | label from `isAttached` | `ec2_volume_inventory_snapshots.is_attached` |
| Attached Instance | id/name (link) | `ec2_volume_inventory_snapshots.attached_instance_id` + instance lookup |
| Instance Name | `attachedInstanceName` | join to `ec2_instance_inventory_snapshots` |
| Instance State | `attachedInstanceState` | same join |
| Region | `regionName/regionId/regionKey` | `dim_region` via `region_key` |
| Created Time | discovered/usage date | `ec2_volume_inventory_snapshots.discovered_at` |
| Last Attached Time | metadata fallback keys | `metadata_json.lastAttached*` |
| Recommendation | UI badge from flags | `is_unattached`, `is_attached_to_stopped_instance`, `is_idle_candidate`, `is_underutilized_candidate` |

### Row click behavior
- Row click -> Volume Detail page `/dashboard/inventory/aws/ec2/volumes/:volumeId`
- Attached instance cell click -> Instance Detail page

Connection paths:
- Instance List -> Volume List via `attachedInstanceId` query parameter.

---

## 8) Volume Detail Page

File: `frontend/src/features/dashboard/pages/ec2/EC2VolumeDetailPage.tsx`

Important: like instance detail, many tab values are frontend-derived placeholders.

### Tabs
1. **Overview**
- KPI cards + simple trends.
- Source: selected volume row from list API + derived values.

2. **Cost**
- Cost category split (storage/iops/throughput/snapshot) uses fixed percentages from total.
- Needs verification (not backend-calculated factual split).

3. **Attachment**
- Shows attached instance link/state and metadata-based attach fields.
- Source: volume row + `metadata_json` keys.

4. **Performance**
- Displays synthetic trend + estimated stats from `iops/throughput` fields.
- Needs verification for production-grade metrics (actual API exists at `/inventory/aws/ec2/volumes/performance`).

5. **Snapshots**
- Current page uses synthetic single-row snapshot entry.
- Needs verification to switch to real snapshot inventory API.

6. **Recommendations**
- Local rule-based one-row recommendation.
- Not using persisted recommendations endpoint.

7. **Metadata**
- Volume identity, encryption/KMS, tags table.

---

## 9) Recommendation Page

Files:
- Frontend: `frontend/src/features/dashboard/pages/ec2/EC2OptimizationPage.tsx`
- Backend refresh/list: `backend/src/features/ec2/optimization/ec2-recommendations.*`
- Persistence table: `fact_recommendations`

### Category structure
- Overview
- Compute
- Storage
- Pricing

### Supported recommendation types
- `idle_instance`
- `underutilized_instance`
- `overutilized_instance`
- `unattached_volume`
- `old_snapshot`
- `uncovered_on_demand`

### Logic (refresh job endpoint)
Source: `Ec2RecommendationsService.refreshRecommendations()`.

| Type | Logic summary | Core fields/tables |
|---|---|---|
| `idle_instance` | running + enough hours + cost>5 and `avgCpu<5` and `avgDailyNetworkMb<100` | `fact_ec2_instance_daily` aggregates |
| `underutilized_instance` | running + enough hours + cost>5 and `5<=avgCpu<20` and `avgDailyNetworkMb<1024` | `fact_ec2_instance_daily` aggregates |
| `overutilized_instance` | `avgCpu>75` | `fact_ec2_instance_daily` aggregates |
| `uncovered_on_demand` | pricing on-demand + compute cost>5 + activeDays>=3 + no coverage | `fact_ec2_instance_daily` + covered hours |
| `unattached_volume` | volume state available, unattached, cost>5, age>=7 days | `ec2_volume_inventory_snapshots` + `fact_ebs_volume_daily` |
| `old_snapshot` | age>=90 days, cost>5, not protected by retention-like tags | `ec2_snapshot_inventory_snapshots` + `fact_cost_line_items`/`dim_resource` |

### Persistence and upsert behavior
- Table: `fact_recommendations`
- Source system: `KCX_EC2_OPTIMIZATION_V1` for this page flow.
- Identity key for upsert: tenant + cloudConnection + billingSource + category + type + resourceType + resourceId.
- Existing recommendation status preserved if currently `accepted/ignored/snoozed`; else set to `OPEN` on refresh.
- Missing generated keys from previous run are marked `COMPLETED`.
- Status patch endpoint updates `status` for one recommendation id.

### Status lifecycle used
`open`, `accepted`, `ignored`, `snoozed`, `completed` (frontend lowercase mapping over DB uppercase).

### Frontend columns
- Compute tab: instance, issue type, CPU, network, cost, evidence, action, saving, risk, status.
- Storage tab: resource, type, issue, size, cost, state, evidence, action, saving, risk, status.
- Pricing tab: instance, issue, cost, coverage, evidence, action, saving, risk, status.

---

## 10) Filters and Group By Logic

### Common filters
- Date range (`from/to`, `startDate/endDate`, `billingPeriodStart/End`) normalized in backend schemas.
- Scope resolution via dashboard scope resolver for tenant/provider/billing source/account/region.

### Page-specific filters
- Explorer: metric, groupBy, costBasis, usage metric/aggregation, condition, tags, states, types, thresholds.
- Instance list: state, type, pricing, search, date.
- Volume list: state, type, attachment, optimization signal/status, region, search, date.
- Recommendations: category/type/status/account/region/team/product/environment/tags/date range.

### Group-by behavior in Explorer
- Backend-supported: `none`, `region`, `instance_type`, `reservation_type`, `cost_category`, `tag`.
- `groupValues` filter applies on resolved group value.

Needs verification:
- Frontend `usage-category` option mapping is not supported by backend explorer schema.

### Filter preservation in navigation
- Explorer -> Instance List passes context in URL params (`source`, `groupBy`, `groupValue`, date/scope params).
- Instance List -> Volume List passes `attachedInstanceId`.
- Volume/Instance list -> details keep current query string for context.

---

## 11) API Endpoints

| Method + Path | Purpose | Params | Response shape | Used by | Backend entry |
|---|---|---|---|---|---|
| `GET /dashboard/ec2/explorer` (also `/ec2/explorer`) | Explorer summary/graph/table | metric/groupBy/date/tags/thresholds/etc | `{summary, graph, table}` | Explorer page | `backend/src/features/ec2/explorer/ec2-explorer.controller.ts` |
| `GET /inventory/aws/ec2/instances` | Instance list | state/type/pricing/search/date/paging | `{items,pagination}` | Instance list/detail | `instances-inventory.controller.ts` |
| `GET /inventory/aws/ec2/instances/performance` | Instance performance timeseries | instanceId, interval, topic, metrics, date | performance series | EC2 Performance page | `instances-inventory.controller.ts` |
| `GET /inventory/aws/ec2/volumes` | Volume list + summary | state/type/attachment/signal/search/date/paging | `{items,summary,dateRange,pagination}` | Volume list/detail | `volumes-inventory.controller.ts` |
| `GET /inventory/aws/ec2/volumes/performance` | Volume performance timeseries | volumeId, interval, topic=ebs, metrics, date | performance series | EC2 Performance page | `volumes-inventory.controller.ts` |
| `GET /inventory/aws/ec2/snapshots` | Snapshot list + summary | state/storageTier/encrypted/search/paging | `{items,summary,pagination}` | Snapshot inventory flows | `snapshots-inventory.controller.ts` |
| `GET /dashboard/ec2/recommendations` (also `/ec2/recommendations`) | Fetch persisted EC2 recommendation groups | date, scope, category/type/status/account/region/team/product/env/tags | `{overview,recommendations}` | EC2 Optimization page | `ec2-recommendations.controller.ts` |
| `POST /dashboard/ec2/recommendations/refresh` | Regenerate and upsert recommendations | dateFrom/dateTo/cloudConnection/billingSource | `{created,updated,resolved}` | Manual refresh/action flows | `ec2-recommendations.controller.ts` |
| `PATCH /dashboard/ec2/recommendations/:id/status` | Update recommendation status | `status` body | `{id,status}` | Recommendation lifecycle UI | `ec2-recommendations.controller.ts` |
| `GET /dashboard/ec2/optimization/summary` | Optimization summary view over persisted recs | recommendationType/risk/status/scope/date | optimization response | legacy/new optimization consumers | `ec2-optimization.controller.ts` |
| `GET /dashboard/ec2/optimization/instances` | Same dataset for instance-focused consumers | same | optimization response | legacy/new optimization consumers | `ec2-optimization.controller.ts` |

---

## 12) Gaps / TODOs

1. Explorer additional costs
- Snapshot/EIP add-on costs are currently hardcoded to zero in explorer (`getAdditionalDailyCosts`).

2. Explorer group-by mismatch
- Frontend includes `usage-category`; backend explorer schema does not support it.

3. Instance list total cost naming
- `monthToDateCost` currently mirrors compute cost in backend response mapping; naming suggests broader total.

4. Instance detail tabs are partly placeholder logic
- Cost split/network/previous period/savings and trend lines are mostly frontend-derived, not direct backend analytical queries.

5. Instance metadata source
- Metadata tab currently reads tags from first attached volume, not instance tags. Needs verification.

6. Volume detail tabs are partly placeholder logic
- Cost split percentages, performance trends, and snapshot row are synthetic.

7. Recommendation type naming mismatch across systems
- `EC2OptimizationService` uses types like `unattached_ebs_volume`, while recommendations V1 uses `unattached_volume`.
- Needs verification for unification strategy.

8. Status taxonomy differences
- Different parts of optimization/recommendation flows use different status conventions (`OPEN/COMPLETED` vs `RESOLVED/APPLIED` handling in other services). Needs verification.

9. Frontend fallback parsers
- Inventory API clients include fallback parsing paths (`TODO(inventory-frontend)` comments), indicating response shape not fully frozen.

10. Production-grade KPI assurance
- Several detail-page KPIs are presentational approximations and should be replaced/validated against backend factual series endpoints.
