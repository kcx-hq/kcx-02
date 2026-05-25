# Database Explorer v2: Phase-1C to Phase-2B.4 (KPI + Controls Contract Chat)

## Summary
This chat covered Database Explorer v2 contract and validation work across:
- Phase-1C: KPI contract/refactor (mode-aware KPI sets)
- Phase-1D: KPI validation pass
- Phase-2B.1: filter/groupBy scan-only pass
- Phase-2B research: pattern extraction from EC2/Cost modules
- Phase-2B.3: analytical controls refactor (`groupBy + groupValues`)
- Phase-2B.4: controls validation pass and bug fix

No chart/table/drilldown redesign was requested or introduced.

## Phase-1C: KPI Contract Goals
- Cost mode must return exactly 5 cost KPIs:
  1. Total Database Spend
  2. Cost Trend %
  3. Top Cost Driver
  4. Top Charging Service
  5. Highest Cost Region
- Usage mode must return exactly 5 usage KPIs:
  1. Active DB Resources
  2. Peak Usage Driver
  3. Operational Hotspot
  4. Storage Footprint
  5. Activity Trend
- KPI card contract required:
  - `id`, `title`, `value`, `subValue`, optional `trend`, `state`, optional note/tooltip source.
- Required behavior:
  - keep existing scope/date/filter behavior intact
  - preserve graph/table response
  - do not fabricate telemetry
  - usage KPIs must report `partial` / `unavailable` honestly when metrics are missing

## Phase-1D: KPI Validation Intent
Validation checklist focused on:
- exact 5 KPI cards per mode
- no legacy mixed cards remaining
- no cost KPIs in usage mode and no usage telemetry KPIs in cost mode
- graceful rendering of `empty/partial/unavailable`
- graph/table/filter/groupBy/drilldown behavior unchanged

## Phase-2B.1 Scan (No Implementation)
Requested inspection outputs:
- current frontend filters
- backend-supported filters/query params
- current frontend groupBy options
- backend-supported groupBy values
- filter option generation path
- source lineage (fact/cost history/inventory/constants)
- mismatches and dead/unused controls

## Phase-2B Research (Decision-Only)
Core UX decision finalized in chat:
- Database Explorer v2 should center analytical interaction on:
  - `GroupBy + Values`
- Avoid adding many standalone filters.

Final mode-aware groupBy contract specified:
- Cost mode:
  - `db_service`, `db_engine`, `region`, `cost_category`, `resource_type`
- Usage mode:
  - `db_service`, `db_engine`, `region`, `instance_class`, `cluster`

Hard constraints:
- cost mode must not allow `instance_class` / `cluster`
- usage mode must not allow `cost_category`
- no cost-basis overlay controls (amortized/net/effective) yet
- no search as explorer graph/table filter
- keep existing UI shell and layout style

## Phase-2B.3 Implementation (Controls Refactor Only)
Implemented behaviors discussed:
- Removed DB explorer `groupBy=auto` interaction model.
- Added strict mode-aware groupBy handling in frontend and backend.
- Added selectable `groupValues` in controls drawer.
- Sent selected values as `group_values` query param.
- Added backend parsing + normalization of `group_values`.
- Added backend metric/groupBy validation matrix.
- Mode switch resets:
  - invalid cost-mode groupBy -> `db_service`
  - invalid usage-mode groupBy -> `db_engine` with `db_service` fallback when engine options unavailable
- Pruned stale `groupValues` when current dimension options change.

## Phase-2B.4 Validation Pass + Fix
Validation confirmed:
- mode-specific groupBy options enforced
- values selector updates by selected groupBy
- `group_values` is sent from frontend
- no old `groupBy=auto` behavior in DB explorer controls
- builds passed

Bug found/fixed in validation:
- `group_values` filtering was not consistently applied on all fact-table query paths.
- Backend was patched so selected values are applied consistently across explorer data paths.

## Build/Typecheck Outcomes (as reported in chat)
- Backend build: passed
- Frontend build (`tsc -b && vite build`): passed

## Decisions Locked by This Chat
- Keep KPI meaning server-defined (not frontend-derived).
- Keep controls mode-aware and backend-enforced.
- Use `groupBy + groupValues` as primary analytical control model.
- Defer cost-basis overlays and other advanced finance controls to later phases.
- Preserve existing graph/table/drilldown behavior during these phases.
