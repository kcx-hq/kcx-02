# 17 - Database Explorer Cost Insight Scans, Phase-1 Cost Basis, and Hotfixes

## Scope of This Chat
This chat covered a full sequence focused on **Database Explorer v2 Cost Mode**:
- Insight-quality audit requests (not bug-only)
- State/flow scans across frontend and backend
- EC2 Cost Basis reference scan for reuse patterns
- Phase-1 implementation of DB Explorer Cost Controls + Cost Basis
- Narrow post-implementation fixes
- Final cleanup request to remove `net_unblended_cost` from DB Explorer

## 1) Product Insight-Quality Audit (Cost Mode)
- Reviewed KPI/cards, grouped tables, Group By states, and cost trend views from provided screenshots.
- Assessed whether Cost mode gives real FinOps insight vs grouped billing slices.
- Key conclusion theme:
  - Current Explorer provides basic spend slicing and simple concentration signals.
  - It is still limited in advanced FinOps intelligence (driver depth, anomaly attribution, behavior explanation, optimization guidance).

## 2) Read-Only Architecture/State Scan Requests
- Audited current DB Explorer Cost mode contracts and flow without code changes for:
  - Route/component ownership
  - KPI state and graph state
  - Database scope selector behavior
  - Group By drawer/control behavior
  - Existence of `group_values`, `groupValues`, `groupedValuePreview`
  - Frontend API params sent
  - Backend parser/validator handling
  - Repository SQL filter paths
  - Grouped table column sources
  - Leftover duplicate/broken UI from earlier attempts
- Also scanned EC2 Explorer **Cost Basis** path as reference:
  - options/state ownership
  - API param
  - backend parsing and calculation mapping
  - reusable vs EC2-specific coupling

## 3) DB Explorer Flow Scan Before Phase-1
- Documented current end-to-end Cost/Usage mode flow:
  - mode toggle
  - Group By control
  - Database scope selector
  - Resource Type and Cost Category controls
  - query params and backend validation
  - repository aggregation paths (`db_cost_history_daily`, `fact_db_resource_daily`)
- Confirmed phase constraints to avoid risky migration:
  - no migration to `fact_cost_line_items` in this phase
  - no redesign of KPI/graph/group behavior

## 4) Phase-1 Implementation: Cost Controls + Cost Basis
- Added DB Explorer `costBasis` contract end-to-end (frontend + backend).
- Preserved existing Group By / group values behavior and usage mode behavior.
- Introduced Cost Basis options in DB Explorer Cost mode:
  - `billed_cost`
  - `effective_cost`
  - `amortized_cost`
  - `net_amortized_cost`
  - `net_unblended_cost` (later removed in final cleanup request)
- Applied cost-basis mapping with fallback behavior across DB Explorer cost outputs:
  - KPI cost aggregates
  - cost trend
  - grouped trend
  - grouped table cost totals/breakdowns
- Kept usage metrics unaffected by cost basis.
- Maintained control order:
  1. Group By
  2. Cost Basis
  3. Database
  4. Resource Type
  5. Cost Category

## 5) Phase-1 Narrow Fixes
Two targeted issues were addressed after implementation:

1. **Cost values disappearing at default**
- Root cause: defaulting to `effective_cost` while current DB fact rows had billed values populated and effective/amortized/net mostly zero/unpopulated.
- Fix: changed DB Explorer default Cost Basis to `billed_cost` in frontend and backend defaults.

2. **Resource Type / Cost Category opening wrong panel**
- Root cause: control-row interaction coupling to Group By panel.
- Fix: made Resource Type and Cost Category independent dropdowns.
- Group By drawer now opens only from Group By control.
- Selecting Resource Type/Cost Category no longer mutates `groupBy`.

## 6) Final Cleanup in This Chat
- Removed `net_unblended_cost` from Database Explorer Cost Basis support surface:
  - removed from DB Explorer backend enum
  - removed from DB Explorer frontend Cost Basis options
- EC2 support remained untouched.

## 7) Key Files Involved Across This Chat
- `backend/src/features/database/explorer/explorer.types.ts`
- `backend/src/features/database/explorer/explorer.validators.ts`
- `backend/src/features/database/explorer/explorer.repository.ts`
- `frontend/src/features/dashboard/api/dashboardTypes.ts`
- `frontend/src/features/dashboard/api/dashboardApi.ts`
- `frontend/src/features/dashboard/pages/database/DatabaseExplorerPage.tsx`
- `frontend/src/features/dashboard/pages/database/components/DatabaseExplorerFilters.tsx`
- `frontend/src/features/dashboard/pages/database/components/DatabaseExplorerGroupedTable.tsx`

## 8) Validation Outcomes Captured
- Backend build validations were run and passed in relevant implementation/fix steps.
- Frontend build validations were run and passed in relevant implementation/fix steps.
- DB Explorer retained core behavior:
  - Group By flow preserved
  - `group_values` flow preserved
  - Database scope preserved
  - Usage mode unchanged

## Final Outcome
This chat established a safer Cost-mode foundation for Database Explorer:
- audited insight quality and architecture state,
- implemented phase-1 cost basis/control plumbing conservatively,
- corrected default basis and control interaction regressions,
- and narrowed DB Explorer basis options by removing `net_unblended_cost`.
