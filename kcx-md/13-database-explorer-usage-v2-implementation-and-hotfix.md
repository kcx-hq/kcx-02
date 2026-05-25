# 13 - Database Explorer Usage v2 Implementation and Hotfix

## Summary
This chat covered end-to-end implementation of Database Explorer Usage v2 across backend and frontend, followed by a production error fix.

## Topics Covered
1. Phase 1 + 2 (Backend Foundation + KPI Layer)
- Added capability-aware Usage contract (`capability_family`, `usage_metric`).
- Added backend-owned semantic fields:
  - `capabilityAvailability[]`
  - `coverageSummary`
  - `usageKpis[]`
  - `warnings[]`
- Removed fake `load` KPI semantics and moved to explicit metric-driven aggregation.
- Implemented confidence/state semantics (`high`, `medium`, `low`, `degraded`, `unsupported`, `unavailable`).
- Kept Cost mode behavior unchanged.

2. Phase 3 + 4 (Usage Graph + Grouped Table Layer)
- Updated Usage `trend` and `trendGrouped` to selected capability/metric semantics.
- Added metadata in Usage trend/grouped trend (unit, capability, metric, coverage/warnings where available).
- Stopped zero-fill for missing Usage telemetry in grouped trend (now null/missing-safe).
- Implemented Usage grouped table as operational concentration (rank, coverage, confidence, primary metric, capability-specific fields).
- Preserved Cost table and Cost grouped trend behavior.

3. Phase 5 + 6 (Frontend Controls + Integration Polish)
- Added Usage-only capability selector.
- Added Usage-only metric selector with valid family/metric combinations.
- Wired `capability_family` and `usage_metric` into Explorer API requests.
- Updated Usage KPI cards to prefer backend `usageKpis[]`.
- Updated Usage graph titles/tooltips to selected metric semantics and preserved null gaps.
- Updated Usage grouped table columns to operational fields (not cost-shaped columns).
- Added compact Usage warnings rendering from backend warnings.
- Kept Group By drawer behavior unchanged.
- Kept Cost mode rendering and request behavior unchanged.

4. Runtime Error and Fix
- Reported issue: repeated `500` on Usage Explorer request.
- Stack indicated failure in `DatabaseExplorerRepository.getCards` query.
- Root cause: alias mismatch in Usage KPI SQL expression (`f.*` fields used without `FROM ... f` alias in CTE).
- Fix applied:
  - Aliased fact table as `f` in both current/previous CTEs.
  - Built CTE filters with alias-aware `buildFactFilters(..., "f")`.
- Backend build validated after fix.

## End State
- Usage v2 now has capability-aware backend semantics and frontend controls integration.
- Usage rendering uses backend validity/coverage/confidence semantics rather than frontend guessing.
- Cost mode remains stable and behavior-preserved.
