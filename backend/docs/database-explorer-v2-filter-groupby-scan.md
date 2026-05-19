# Database Explorer v2 Filter + GroupBy Scan (Read-Only)

## 1. Files changed / relevant files found

### Modified today/recent in working tree (Explorer-related)
- `backend/src/features/database/explorer/explorer.repository.ts`
- `backend/src/features/database/explorer/explorer.types.ts`
- `backend/src/features/database/explorer/explorer.validators.ts`
- `frontend/src/features/dashboard/api/dashboardApi.ts`
- `frontend/src/features/dashboard/api/dashboardTypes.ts`
- `frontend/src/features/dashboard/pages/database/DatabaseExplorerPage.tsx`
- `frontend/src/features/dashboard/pages/database/components/DatabaseExplorerFilters.tsx`
- `frontend/src/features/dashboard/pages/database/components/DatabaseExplorerTrend.tsx`

### Additional relevant files scanned
- `backend/src/features/database/database.routes.ts`
- `backend/src/features/database/explorer/explorer.controller.ts`
- `backend/src/features/database/explorer/explorer.service.ts`
- `backend/src/features/database/explorer/explorer.database-scope.ts`
- `frontend/src/features/dashboard/hooks/useDashboardQueries.ts`
- `frontend/src/features/dashboard/pages/database/databaseExplorer.scope.ts`
- `frontend/src/features/dashboard/pages/database/db-assets-page.tsx`

## 2. What is implemented correctly

- KPI mode-aware validation exists on backend:
  - `explorer.validators.ts` enforces metric-specific allowed `group_by` using `COST_GROUP_BY` and `USAGE_GROUP_BY`.
- Frontend also enforces mode-specific group dimensions:
  - `DatabaseExplorerPage.tsx` resets invalid `groupBy` on metric switch.
  - `DatabaseExplorerFilters.tsx` disables non-allowed dimensions per current metric.
- Scoped `group_values` behavior is now implemented backend-side:
  - `explorer.repository.ts` builds SQL filters via `buildGroupedValuesFilter(...)` and applies them in trend/table/drilldown SQL paths.
- API query param generation is aligned for explorer:
  - frontend sends `group_by`, `group_values`, `database_scope`, `db_service`, `db_engine`, `region_key`, `cloud_connection_id` in `dashboardApi.ts`.
- Backend parser accepts both snake/camel for group values (`group_values` and `groupValues`) and normalizes values.
- `filterOptions.groupedValuePreview` is returned with per-dimension value lists and consumed by frontend drawer for value selection.

## 3. What is partially implemented

- Control model is close but still mixed:
  - Group By + scoped values exists and is clickable.
  - But separate `Database` selector (`database_scope` + `db_service` + `db_engine`) remains independently active, so user can stack two filtering models at once.
- Mode-aware dimensions are enforced, but preview payload remains broad:
  - backend returns preview arrays for both cost-only and usage-only dimensions in same response; frontend hides/disables by mode.
- Grouped charts are implemented, but cost/usage semantics differ by source tables:
  - cost_category grouping reads from `db_cost_history_daily`; other groups read from `fact_db_resource_daily`.
  - This is intentional but contract/docs are not explicit in response metadata.

## 4. What is missing/skipped

- No explicit backend response contract metadata stating allowed `groupBy` for current `metric`.
  - UI currently hardcodes this logic.
- No explicit backend validation that `group_values` belong to currently selected `group_by` value domain.
  - Invalid values are effectively ignored by SQL no-match behavior, not rejected.
- No dedicated contract field describing active filter model (e.g., which dimensions are scope filters vs group filter).
- No URL/state hydration on Database Explorer page for `metric/group_by/group_values` from query params.
  - State is local defaults; deep-link reproducibility is partial.

## 5. Exact bugs or mismatches

- **Contract/encoding quality bug:** multiple files contain mojibake text in comments/labels (`â‰¥`, `â†’`, `â€¢`, `â€”`) indicating encoding corruption:
  - `backend/src/features/database/explorer/explorer.types.ts`
  - `backend/src/features/database/explorer/explorer.database-scope.ts`
  - `frontend/src/features/dashboard/api/dashboardTypes.ts`
  - `frontend/src/features/dashboard/pages/database/databaseExplorer.scope.ts`
- **UX-model mismatch:** chip label still uses generic `Values` even though expected model is “Filters = scoped values for selected dimension”:
  - `DatabaseExplorerFilters.tsx` chips section.
- **Potential semantics mismatch in drilldown URL params:** explorer drilldown sets `groupValue`/`clickedLabel`, but assets page reads concrete filters (`db_service`, `db_engine`, `instance_class`, etc.).
  - Current implementation works only because explorer also sets some concrete keys conditionally; `groupValue` itself is not consumed by assets page.

## 6. Backend contract status

### Status: **Mostly consistent, but implicit in key areas**

- Endpoint and wiring are correct: `GET /services/database/explorer`.
- Request contract:
  - Supports `metric`, `group_by`, `group_values`, `database_scope`, `db_service`, `db_engine`, `region_key`, date range.
  - Validates metric-specific groupBy compatibility.
- Response contract:
  - Returns `filters`, `filterOptions`, `cards`, `trend`, `trendGrouped`, `table`.
  - `filterOptions.groupedValuePreview` present and populated.
- Gaps:
  - Allowed dimensions per metric are not returned as first-class backend metadata.
  - Response does not explicitly declare “groupBy filter values are scoped to selected dimension” as contract metadata.

## 7. Frontend contract status

### Status: **Functional and mostly aligned, with local hardcoding**

- API client sends expected snake_case params for explorer.
- Page state tracks `metric`, `groupBy`, `groupValues`, and filters; query hook wiring is correct.
- UI prevents invalid groupBy per metric and clears stale values on mismatch.
- Gaps:
  - Allowed groupBy dimensions are hardcoded in frontend (duplicated logic from backend).
  - No URL hydration for explorer state; reproducibility/shareability is limited.

## 8. UI/UX problem summary

- Current UI is better than prior “preview-only values”; values are now selectable.
- However, control surface still blends two concepts:
  - `Database` filter panel (scope/service/engine)
  - `Group By` + `Values`
- This can feel like unrelated standalone filters instead of one clear analytic model.
- Terminology still partially generic (`Values`) instead of explicit `Filters` tied to selected dimension.

## 9. Recommended next fix order

1. **Finalize contract first (backend + shared types):**
   - Return `allowedGroupByByMetric` (or `allowedGroupBy` for active metric) from backend.
   - Optionally return `activeDimensionValues` for current `groupBy` directly to reduce UI coupling.
2. **Normalize frontend to backend contract source-of-truth:**
   - Remove hardcoded allowed-dimension maps where possible.
   - Use returned allowed dimensions to render/disable options.
3. **Unify control model language and behavior:**
   - Rename chip/section from `Values` to `Filters` scoped to selected dimension.
   - Make interaction model explicit: `Group By` selects dimension; `Filters` selects allowed values for that dimension.
4. **URL/state consistency:**
   - Add query param hydration for `metric`, `group_by`, `group_values`, `database_scope`, `db_service`, `db_engine`.
5. **Cleanup/quality pass:**
   - Fix mojibake encoding artifacts in comments/labels/types docs.

## 10. Do not fix yet — scan only

- This report is read-only and no implementation files were modified.
