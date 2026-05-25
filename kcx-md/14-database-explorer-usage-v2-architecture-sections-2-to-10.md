# 14 - Database Explorer Usage v2 Architecture (Sections 2 to 10)

## Scope of This Chat
This chat covered the architecture/research planning sequence for Database Explorer Usage Mode:
- Section 2: Telemetry Reality + Capability Mapping
- Section 3: Usage Semantics Architecture
- Section 4: KPI Architecture
- Section 5: Graph Architecture
- Section 6: Grouped Table Architecture
- Section 7: Filters + Controls Architecture
- Section 8: API Contract + Backend Semantics Architecture
- Section 9: UX + Product Workflow Architecture
- Section 10: Final Implementation Phasing Plan

No implementation was requested or performed in these sections.

## Section 2 - Telemetry Reality + Capability Mapping
- Established real telemetry maturity as RDS/Aurora-first.
- Confirmed capability taxonomy is broader than implemented telemetry adapters.
- Confirmed `db_utilization_daily` -> merge -> `fact_db_resource_daily` flow is critical.
- Identified weak/empty signals (`load_avg`, `request_count`) and merge/coverage fragility.
- Distinguished production-safe vs partial vs unsupported signals.

## Section 3 - Usage Semantics Architecture
- Defined Usage Explorer as capability-aware portfolio operational intelligence.
- Locked boundaries:
  - Not observability tooling.
  - Not detail telemetry diagnostics.
  - Not cost semantics reuse.
- Defined capability families and maturity tiers tied to real telemetry support.
- Formalized Explorer vs Assets/Detail responsibility split.

## Section 4 - KPI Architecture
- Defined KPI philosophy: confidence-aware posture, not raw metric scoreboard.
- Locked KPI categories:
  - Coverage/Confidence
  - Pressure/Posture
  - Concentration
  - Capacity/Waste
- Defined production-safe initial KPIs and explicitly rejected misleading KPI patterns.
- Locked confidence gating (valid/degraded/informational/unavailable).

## Section 5 - Graph Architecture
- Defined capability-driven graph modes:
  - Portfolio trend
  - Grouped concentration trend
  - Optional scoped comparison
  - Unavailable state
- Locked point semantics:
  - Null means missing telemetry
  - Zero means observed zero
  - No silent zero-fill
- Required series/point coverage metadata and explicit unsupported states.

## Section 6 - Grouped Table Architecture
- Reframed Usage table as operational concentration ranking (not cost-shaped table).
- Defined universal columns:
  - Group, in-scope, covered, coverage %, confidence, posture, concentration share
- Defined capability-specific column families and confidence-aware ranking logic.
- Locked unsupported/informational row behavior and no fake equivalence ranking.

## Section 7 - Filters + Controls Architecture
- Defined control semantics separation:
  - Capability/metric selector = what signal
  - Filters = scope
  - Group By = segmentation pivot
- Preserved accepted Group By drawer interaction.
- Added compatibility-driven control behavior with explicit disabled reasons.
- Locked cost-vs-usage control separation.

## Section 8 - API Contract + Backend Semantics Architecture
- Locked backend as semantic authority; frontend renders contract without guessing.
- Defined usage request contract around:
  - `capability_family`, `usage_metric`, `group_by`, filters, date range, scope
- Defined response contract blocks:
  - capability availability
  - coverage summary
  - KPI semantics
  - graph semantics
  - table semantics
  - warnings/unavailable reasons
- Defined migration guidance away from cost-shaped usage contract assumptions.

## Section 9 - UX + Product Workflow Architecture
- Defined Usage UX as portfolio decision cockpit for operational hotspots.
- Locked primary user flow:
  - capability select -> confidence check -> hotspot/trend validation -> drilldown
- Defined Explorer -> Assets -> Detail -> Recommendations/Cost linkage.
- Defined degraded/unsupported warning semantics as first-class UX behavior.

## Section 10 - Final Implementation Phasing Plan
- Locked practical, deadline-aware implementation order:
  1. Backend contract foundation
  2. KPI layer
  3. Graph layer
  4. Grouped table layer
  5. Frontend controls layer
  6. UX polish + workflow handoff
- Added validation checklist and regression protections:
  - preserve Cost Mode behavior
  - preserve accepted Group By drawer behavior
- Clearly listed deferred scope (non-RDS parity, advanced analytics, synthetic scores).

## Final Outcomes from This Chat
- Usage v2 architecture is fully specified across semantics, contract, controls, workflow, and phased delivery.
- Confidence/coverage-first behavior is a hard requirement across KPIs, graph, and table.
- Cost-shaped usage semantics are formally deprecated at architecture level.
