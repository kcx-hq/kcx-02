# 16 - DB Explorer Phase-1 Filters, Cost-Mode Consistency, and Breakdown Fixes

## Scope of This Chat
This chat focused on Database Explorer Phase-1 behavior corrections and cost-mode consistency, including:
- Top-row filter behavior fixes (single-select, close-on-select, independence from Group By)
- Backend/frontend filter param plumbing validation (`resource_type`, `cost_category`)
- Read-only bug scan/report for remaining cost-mode issues
- Cost-mode cross-source filter consistency fixes
- Cost-mode table breakdown population fixes
- ElastiCache/MemDB cost-category classification improvement for compute/storage/io visibility

## 1) Phase-1 Filter Behavior Fixes
- Fixed `Resource Type` and `Cost Category` top-row filters to be single-select.
- Added explicit `All Resource Types` / `All Cost Categories` clear options.
- Dropdowns now close immediately after option click.
- Preserved Group By drawer behavior; top-row filters no longer use Group By apply flow.
- Frontend now sends both plural and singular params for compatibility:
  - `resource_type_values` + `resource_type`
  - `cost_category_values` + `cost_category`
- Backend validator updated to parse singular fallbacks as well.

## 2) Remaining UI Coupling Fix (Group View Stability)
- Prevented grouped chart rendering from accepting mismatched grouped payloads:
  - grouped trend now rendered only when `trendGrouped.groupBy === active groupBy`.
- Removed DB Explorer placeholder-data carryover in query hook to reduce stale grouped-view flashes.
- Result: top-row filter changes no longer visually switch grouping unexpectedly.

## 3) Read-Only Scan Deliverable
- Produced scan doc:
  - `docs/database-explorer-v2-remaining-cost-bugs-scan.md`
- Findings captured:
  - Split-source filtering inconsistency (fact path vs cost-history path)
  - Why cost-category seemed ignored in some grouped views
  - Why breakdown columns were zero
  - Why top cost driver could show `Other`
  - Safe phased fix strategy

## 4) Cost-Mode Filter Consistency Layer
- Implemented minimal backend consistency plumbing in explorer repository:
  - Cost-history filter path now can honor `resourceTypeValues` via safe `EXISTS` bridge to `fact_db_resource_daily`.
  - Cost-mode grouped table/trend paths standardized on cost-history monetary source while preserving Group By semantics via fact/dim joins.
  - Cost-mode card totals/trend baseline aligned with same filtered cost-history semantics.
- Kept constraints:
  - No Group By redesign
  - No Cost Basis redesign
  - No usage-mode behavioral rewrite
  - No migration to `fact_cost_line_items` explorer architecture

## 5) Cost-Mode Table Breakdown Fix
- Fixed cost-mode table category columns to derive from `db_cost_history_daily` category rows using selected cost basis:
  - `computeCost`, `storageCost`, `ioCost`, `backupCost`
- For non-`cost_category` groupBy rows:
  - category columns now SUM from cost-history `CASE` buckets, not fact fallback zeros.
- For `groupBy = cost_category`:
  - rows no longer forced to misleading all-zero category columns; matching category columns are populated from grouped aggregation.
- Category matching uses normalized comparisons:
  - `LOWER(BTRIM(COALESCE(ch.cost_category, '')))`

## 6) ElastiCache Distinct Category Visibility Fix
- Root cause identified in ingestion classification (`db_cost_history.service.ts`): ElastiCache/MemoryDB signals frequently fell into `other`.
- Added targeted classifier rules for ElastiCache/MemoryDB:
  - `compute`: node/eCPU usage patterns
  - `storage`: bytes-used/storage usage patterns
  - `io`: request/IO patterns
- Important note:
  - Existing rows require reprocessing/rebuild of `db_cost_history_daily` for affected dates to reflect new classification.

## 7) Build/Validation Outcomes
- Backend TypeScript builds passed after backend changes.
- Frontend build intermittently failed at Vite chunk rendering in environment (non-TS runtime bundling stage); backend fixes were unaffected.
- No UI redesign was introduced in this sequence.

## Files Touched in This Chat (Major)
- `frontend/src/features/dashboard/pages/database/components/DatabaseExplorerFilters.tsx`
- `frontend/src/features/dashboard/pages/database/components/DatabaseExplorerTrend.tsx`
- `frontend/src/features/dashboard/hooks/useDashboardQueries.ts`
- `frontend/src/features/dashboard/api/dashboardApi.ts`
- `backend/src/features/database/explorer/explorer.validators.ts`
- `backend/src/features/database/explorer/explorer.repository.ts`
- `backend/src/features/billing/services/db-cost-history.service.ts`
- `docs/database-explorer-v2-remaining-cost-bugs-scan.md`

## Final Outcome
- DB Explorer Phase-1 filters now behave as independent top-row controls.
- Cost-mode outputs are substantially more consistent under `resource_type` and `cost_category` filters.
- Cost-mode table category breakdown columns now use reliable category-source data.
- ElastiCache category classification was improved so compute/storage/io splits can become visible after reprocessing.
