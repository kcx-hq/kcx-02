# Database Recommendations Phases, Taxonomy Normalization, and Explorer Filter UX

## Chat Scope
This chat covered a full multi-phase Database module refactor and cleanup sequence across:
- Database Recommendations page architecture
- Recommendation-family tabs and UX behavior
- Drawer prioritization
- Overview cleanup
- KPI density reduction
- Database Explorer taxonomy normalization (backend-first)
- Database Explorer filter UX alignment and nested flyout behavior

## Major Topics Covered

### 1. Database Recommendations Structural Planning
- Compared Optimization module structure vs current Database Recommendations implementation.
- Identified over-filtered single-table anti-pattern.
- Defined target tab architecture:
  - Overview
  - Storage Optimization
  - Idle Candidates
  - HA Cost Review
  - Engine / Deployment Review
- Established informational-only action language constraints.

### 2. Phase-1 Recommendations Refactor (Implemented)
- Converted one mixed table into tabbed family workspace.
- Kept route unchanged: `/dashboard/services/database/recommendations`.
- Applied family-to-type mapping:
  - `DB_STORAGE_OPTIMIZATION`
  - `DB_IDLE_CANDIDATE`
  - `DB_HA_COST_OPTIMIZATION`
  - `DB_ENGINE_DEPLOYMENT_OPTIMIZATION`
- Simplified top-level filters to Status, Region, Engine (+ optional Search).
- Removed Recommendation Type/Confidence/Evidence/Resource Type from top-level filter UX.
- Kept existing detail drawer.

### 3. Phase-2 Planning Scan (No Code Change)
- Inspected response shape and metadata/evidence fields.
- Produced family-by-family UI plan:
  - tab purpose
  - candidate summary cards
  - focused columns
  - drawer emphasis
  - empty-state language
  - required vs nice-to-have gaps

### 4. Phase-2A (Implemented)
- Added family-specific table presets (shared component, no duplication).
- Added family-specific action labels:
  - View details
  - Review evidence
  - View
- Added family-specific empty-state copy.

### 5. Phase-2B (Implemented)
- Added family-specific compact summary cards above family tables.
- Used list-response available fields only.
- Applied safe savings visibility handling (no fake savings claims).

### 6. Phase-2C (Implemented)
- Kept same drawer/data model; changed section priority by recommendation family.
- Added family-aware ordering emphasis (cost-first, signal-first, rule-context-first as needed).

### 7. Overview Cleanup (Implemented)
- Removed old mixed-backlog feel from Overview tab.
- Shifted Overview into summary + family navigation orientation.
- Added/retained family cards and overview-level review-oriented copy.

### 8. Family-Tab KPI Density Refinement (Implemented)
- Replaced heavy family KPI rows with compact contextual insight strip.
- Kept Overview cards intact.
- Made tables the dominant investigative element.

### 9. Database Explorer Taxonomy Normalization (Backend-First)
- Requirement: do not hardcode taxonomy in frontend.
- Added `db_type` group-by support across backend + frontend contracts.
- Set Explorer default grouping to Database Type.
- Implemented backend classification mapping for:
  - Relational
  - Key-Value
  - In-Memory
  - Document
  - Graph
  - Wide Column
  - Time Series
- Kept existing `db_service` group-by behavior available separately.

### 10. Taxonomy Regression Investigation and Fix
- Symptom: `Unknown database type` shown for existing `AmazonRDS` rows.
- Root cause found in backend token normalization order.
- Verified actual live values in:
  - `fact_db_resource_daily`
  - `db_cost_history_daily`
- Fixed classification source/tokenization and added robust service aliases/fallbacks.
- Validated grouped output resolves to `Relational` for RDS rows.

### 11. DB Filters UX Alignment with S3/EC2
- Upgraded Database Assets + Recommendations filters from basic form controls to control-surface pattern:
  - tray-style triggers
  - popover option selection
  - chip summary
  - clear-all pattern
- Preserved existing backend API/filter semantics.

### 12. Database Explorer Nested Filter UX Iterations
- Reworked Explorer filter to reduce “scope vs group-by” overlap.
- Introduced nested Database selector (service -> engine).
- Updated behavior so sub-choices appear on hover.
- Final refinement: engine submenu opens as side flyout (Windows context-menu mechanism), not inline.

## Guardrails Maintained Throughout
- No backend recommendation-rule changes.
- No backend API contract redesign unless needed.
- Informational recommendation semantics only (no remediation action language).
- No fake savings claims.
- Reuse existing components where possible.
- Build validation performed after implementation passes.

## Net Outcome
The Database module now has:
- A clearer recommendation investigation workflow
- Better separation of summary vs operational views
- Safer taxonomy semantics in Explorer via backend normalization
- Filter UX parity with S3/EC2 patterns
- Nested flyout behavior for Explorer database service/engine selection
