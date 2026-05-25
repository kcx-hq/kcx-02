# Database Explorer V2 Remaining Cost Bugs Scan

## Scope
Read-only scan of:
- `backend/src/features/database/explorer/explorer.validators.ts`
- `backend/src/features/database/explorer/explorer.service.ts`
- `backend/src/features/database/explorer/explorer.repository.ts`
- frontend request builder (`frontend/src/features/dashboard/api/dashboardApi.ts`) only for param wiring

No code changes were made.

## 1. Query params sent for `resource_type` and `cost_category`
From `withDatabaseExplorerFilters(...)` in frontend request builder:
- Resource Type:
  - `resource_type_values=<csv>`
  - `resource_type=<first-selected-value>`
- Cost Category:
  - `cost_category_values=<csv>`
  - `cost_category=<first-selected-value>`

So both plural and singular params are sent when selected.

## 2. Whether backend parses them
From `parseExplorerQuery(...)`:
- `resourceTypeValues` is parsed from first available of:
  - `resource_type_values`
  - `resourceTypeValues`
  - `resource_type`
- `costCategoryValues` is parsed from first available of:
  - `cost_category_values`
  - `costCategoryValues`
  - `cost_category`

Conclusion: yes, backend parses both singular and plural variants.

## 3. Whether repository applies them to each output

### `cards`
- `getCards()` base aggregate uses `buildFactFilters(...)` on `fact_db_resource_daily`.
- `buildFactFilters(...)` does **not** include `resourceTypeValues` or `costCategoryValues`.
- But card sub-cards call `getTable(...)`:
  - Top service -> `groupBy: db_service` (fact path, includes `resourceTypeValues` via `buildResourceDrilldownFilters`)
  - Top region -> `groupBy: region` (fact path, includes `resourceTypeValues`)
  - Top cost driver -> `groupBy: cost_category` (cost-history path, includes `costCategoryValues` via `buildCostHistoryDrilldownFilters`)

Result: cards are partially filtered; not all card numbers use both filters consistently.

### `trend`
- Cost trend path uses `db_cost_history_daily` + `buildCostHistoryDrilldownFilters(...)`.
- Applies `costCategoryValues`.
- Does **not** apply `resourceTypeValues` anywhere in cost trend path.

### `trendGrouped`
- If `groupBy === cost_category`: uses `db_cost_history_daily` + `buildCostHistoryDrilldownFilters(...)`.
  - Applies `costCategoryValues`.
  - Also forcibly restricts series to `operationalCostCategories` (`compute/storage/io/backup/data_transfer`).
- Else: uses fact path + `buildResourceDrilldownFilters(...)`.
  - Applies `resourceTypeValues`.
  - Does not apply `costCategoryValues`.

### `table`
- If `groupBy === cost_category`: uses `db_cost_history_daily` + `buildCostHistoryDrilldownFilters(...)`.
  - Applies `costCategoryValues`.
  - Returns `computeCost/storageCost/ioCost/backupCost` hardcoded as `0`.
- Else: uses fact path + `buildResourceDrilldownFilters(...)`.
  - Applies `resourceTypeValues`.
  - Does not apply `costCategoryValues`.

### `top service`
- Card derives from `getTable({ groupBy: "db_service" })` -> fact path.
- Receives `resourceTypeValues` only.

### `top region`
- Card derives from `getTable({ groupBy: "region" })` -> fact path.
- Receives `resourceTypeValues` only.

### `top cost driver`
- Card derives from `getTable({ groupBy: "cost_category" })` -> cost-history path.
- Receives `costCategoryValues` only.

## 4. Why graph ignores Cost Category filter
Because graph data source depends on grouping path:
- Cost trend (stacked compute/storage/io/backup) uses cost-history and respects `costCategoryValues`.
- Grouped trend for non-`cost_category` groupBy uses fact table path and does not apply `costCategoryValues`.

So in common cost-mode grouping (e.g., DB Service/Region), Cost Category filter is not part of the fact-path WHERE clause, causing inconsistent graph reaction.

## 5. Why table breakdown columns are zero
Two separate reasons exist:
1. By design in `groupBy === cost_category` table path, `computeCost/storageCost/ioCost/backupCost` are explicitly returned as `0`.
2. For non-`cost_category` table path, these columns come from `fact_db_resource_daily` (`SUM(f.compute_cost)`, etc.). If those fact columns are unpopulated or defaulted, breakdown stays zero even when `totalCost` is non-zero (since total may come from `total_*_cost`).

## 6. Are breakdown columns actually populated in DB tables?
Schema/model status:
- `fact_db_resource_daily` has columns: `compute_cost`, `storage_cost`, `io_cost`, `backup_cost` (default 0).
- `db_cost_history_daily` stores per-category rows (`cost_category`, `billed_cost/effective_cost/list_cost`) and appears to be the reliable category source.

From static code scan only, we can confirm columns exist, but cannot prove runtime population percentage in your live data.
Practical implication from current query design: if fact category columns are sparsely populated, table breakdown will show zeros while totals still show spend.

## 7. Why Top Cost Driver returns `Other`
`Top Cost Driver` is taken from `getTable(groupBy=cost_category)` with label mapping:
- known categories map to Compute/Storage/I/O/Backup/Data Transfer/Tax/Credit/Refund
- everything else maps to `Other`

Likely drivers for `Other`:
- Real rows with `cost_category='other'` in `db_cost_history_daily`.
- Null/blank/unexpected category values collapsing into `Other` via `COST_CATEGORY_LABEL_CASE`.
- Cost-category filter interactions that narrow to categories represented as `Other` while service cards still show concrete services from fact table.

## 8. Safest fix plan (no implementation yet)

### A) Filter consistency fix
Goal: make Resource Type and Cost Category filters apply consistently across cards/trend/trendGrouped/table.

Plan:
1. Introduce a unified filter builder strategy for cost mode:
   - Fact-path filters: include `resourceTypeValues` and (where possible) a mapped cost-category constraint.
   - Cost-history-path filters: include `costCategoryValues` and (where possible) resource-type constraint via safe join/bridge.
2. Apply same logical filter set to:
   - `getCards` base aggregate
   - `getTrend`
   - `getTrendGrouped`
   - `getTable`
3. Keep metric/groupBy semantics unchanged; only synchronize filter plumbing.
4. Add regression tests/matrix for combinations:
   - groupBy in `{db_service, region, cost_category}`
   - resourceType selected/unselected
   - costCategory selected/unselected

### B) Breakdown population/display fix
Goal: stop showing misleading zero breakdowns.

Plan:
1. For cost-mode table breakdown fields, derive category splits from `db_cost_history_daily` (source of truth), not only `fact_db_resource_daily` category columns.
2. For `groupBy=cost_category` rows:
   - either populate breakdown columns meaningfully per row (category-specific), or intentionally return null and hide/disable those columns for this grouping.
3. Add data-quality guard:
   - if fact breakdown columns are all zero but total > 0, do not present zeros as trusted category split.

### C) Top driver labeling fix
Goal: reduce false `Other` when meaningful categories exist.

Plan:
1. Normalize cost category input aggressively before label mapping (trim/lower/synonym mapping).
2. Separate `Other` from `Unknown/Unmapped` in labeling for diagnostic clarity.
3. For KPI "Top Cost Driver", consider ranking only operational categories first; fallback to non-operational labels only when operational spend is absent.
4. Add a small diagnostics payload (optional) for category distribution to explain why `Other` won.

## Summary
The core issue is split-source filtering:
- Fact-path outputs primarily honor `resourceTypeValues`.
- Cost-history-path outputs primarily honor `costCategoryValues`.

That split causes KPI/graph/table inconsistencies in cost mode and contributes to zero breakdowns + `Other` top-driver behavior.
