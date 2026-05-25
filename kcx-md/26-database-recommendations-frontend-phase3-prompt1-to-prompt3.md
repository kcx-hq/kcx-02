# 26 - Database Recommendations Frontend Phase-3 (Prompt-1 to Prompt-3)

## Context
This document captures the complete chat sequence for implementing and polishing the **Services ? Database ? Recommendations** frontend in KCX v2.

Route target:
- `/dashboard/services/database/recommendations`

Scope across prompts:
1. Prompt-1: Foundation (route, API wiring, React Query, table skeleton, filters, empty/loading/error states)
2. Prompt-2: Recommendation detail drawer with explainability/evidence
3. Prompt-3: UI polish, label/badge normalization, filter cleanup, integration refinement

---

## Prompt-1 Summary (Foundation)

### Goals implemented
- Added recommendations page route under Database services.
- Wired backend APIs in dashboard API client:
  - `GET /services/database/recommendations`
  - `GET /services/database/recommendations/summary`
  - `GET /services/database/recommendations/:id`
  - `POST /services/database/recommendations/generate`
- Added React Query hooks with dashboard scope conventions:
  - `useDatabaseRecommendations(params)`
  - `useDatabaseRecommendationsSummary(params)`
  - `useDatabaseRecommendationDetail(id)`
  - `useGenerateDatabaseRecommendations()`
- Implemented page skeleton:
  - header/breadcrumb-aligned shell
  - compact summary strip
  - compact filter row
  - recommendations table
  - loading/error/empty states
- Added generate/refresh trigger (non-remediation; no fake rows).

### Navigation integration
- Added Database Recommendations to sidebar/navigation structures.
- Preserved Explorer and Assets behavior/routes.
- Added breadcrumb handling for recommendations route.

### Types added
- `DatabaseRecommendationListItem`
- `DatabaseRecommendationSummary`
- `DatabaseRecommendationDetail`
- `DatabaseRecommendationFilters`
- `GenerateDatabaseRecommendationsResult`

---

## Prompt-2 Summary (Detail Drawer / Explainability)

### Interaction behavior
- Row click opens right-side drawer/panel.
- Selected recommendation id stored in page state.
- Drawer close resets selection.

### Data behavior
- Drawer uses `useDatabaseRecommendationDetail(id)`.
- Query enabled only when drawer open + id present.
- Handles loading, error, and not-found states safely.

### Drawer sections implemented
1. Header
2. Recommendation Summary
3. Resource / Lineage
4. Evidence Used (signals_used)
5. Missing Signals (signals_missing)
6. Cost Breakdown
7. Savings Assumptions
8. Data Quality Warnings
9. Rule Context

### Defensive rendering
- No crashes on missing/partial `metadata_json`.
- Safe fallback for empty signals, missing warnings, partial lineage/rule context.
- Null cost categories shown as **"Not available"**.
- Null savings shown as **"Savings not estimated" / "Not estimated"** where relevant.

---

## Prompt-3 Summary (Polish / Integration Refinement)

### Visual/content polish
- Normalized labels for recommendation type, evidence level, confidence, status display.
- Refined summary cards:
  - Total Recommendations
  - Open Recommendations
  - Estimated Savings (with non-guarantee helper note)
  - Evidence Quality / Warnings
- Refined user-facing errors:
  - "Unable to load database recommendations"
  - "Unable to load recommendation detail"

### Filter UX cleanup
- Kept primary filters:
  - Search, Status, Type, Confidence, Evidence
- Secondary filters now conditionally visible only when options exist:
  - Region, Engine, Resource Type
- Filter reset keeps pagination reset behavior and clean query param sync.

### Table usability updates
- Finalized practical columns:
  - Recommendation, Type, Resource, Evidence, Confidence, Status, Savings, Updated
- Added truncation + title tooltips for long resource/cloud-connection IDs.
- Maintained clickable row affordance for drawer interaction.

### Drawer refinement
- Kept required section order.
- Improved badge text normalization and severity display.
- Improved date/currency/percent formatting consistency.
- Kept remediation/action workflows out of scope.

### Query invalidation refinement
- Generate/refresh mutation invalidates:
  - recommendations list
  - recommendations summary
  - recommendation detail query family

---

## Files Touched in This Chat (Frontend)
- `frontend/src/features/dashboard/routes/DashboardRoutes.tsx`
- `frontend/src/features/dashboard/common/navigation.ts`
- `frontend/src/features/dashboard/common/sidebarIconMap.tsx`
- `frontend/src/features/dashboard/components/DashboardGlobalHeader.tsx`
- `frontend/src/features/dashboard/pages/inventory/AwsInventoryPage.tsx`
- `frontend/src/features/dashboard/api/dashboardApi.ts`
- `frontend/src/features/dashboard/api/dashboardTypes.ts`
- `frontend/src/features/dashboard/hooks/useDashboardQueries.ts`
- `frontend/src/features/dashboard/pages/database/DatabaseRecommendationsPage.tsx`
- `frontend/src/features/dashboard/pages/database/components/db-recommendations.formatters.ts`
- `frontend/src/features/dashboard/pages/database/components/db-recommendations-filters.tsx`
- `frontend/src/features/dashboard/pages/database/components/db-recommendations-table.tsx`
- `frontend/src/features/dashboard/pages/database/components/DatabaseRecommendationDetailDrawer.tsx`

---

## Validation Outcomes
Build validation executed after implementation passes:
- `npm run build` (frontend) passed successfully.
- Existing large-bundle warnings remain unrelated to this feature.

Functional verification completed in scope:
- Route and navigation reachability for Recommendations.
- List + summary API integration.
- Filter query propagation/reset behavior.
- Empty/loading/error UX.
- Row click ? detail drawer.
- Drawer evidence rendering with null/partial-safe fallbacks.

---

## Out-of-Scope (Intentionally Not Done)
- Backend changes
- Recommendation action workflows (accept/dismiss/complete/snooze)
- Remediation execution flows
- Complex charts
- Fake/mock recommendation data
- Explorer/Assets redesign

---

## Next Step Reference
Future phase (Prompt-4 or later) can focus on:
- additional UI polish depth
- finer filter ergonomics
- potential shared badge/theming utilities
- optional detail UX enhancements while preserving explainability-first model
