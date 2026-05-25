# Database Recommendations Foundation Discovery Chat

## Summary
This chat focused on preparing and executing a foundation-level discovery effort for **KCX Database Recommendations** (RDS/Aurora, relational scope only).

The work was architecture-first, not implementation-first.

## What Was Requested
- Create a structured discovery prompt document for KCX Database Recommendations foundation scanning.
- Run deep codebase scans across backend/frontend for:
  - recommendation infrastructure
  - DB signal availability
  - DB identity model stability
  - cost/savings feasibility
  - background processing architecture
  - UI/UX integration points
  - risk/readiness assessment
- Save outputs as markdown artifacts.

## Files Created During This Chat
1. `kcx-db-recommendations-foundation-discovery.md`
2. `kcx-db-recommendations-foundation-scan-results.md`

## Core Topics Covered

### 1. Foundation Discovery Scope Definition
- Recommendations defined as **financial operational intelligence**.
- Explicitly excluded alerting/monitoring/anomaly-style systems.
- V1 target categories validated in scope:
  1. Rightsizing
  2. Idle/Underutilized Databases
  3. Storage Optimization
  4. High Availability Cost Optimization
  5. Engine/Deployment Optimization

### 2. Existing Recommendation Infrastructure Findings
- `fact_recommendations` model and recommendation APIs already exist.
- Lifecycle/status pattern exists (`OPEN`, `IGNORED`, etc.) with status lifecycle migration support.
- Existing recommendation generation is mostly service-specific (EC2/idle/commitment), not DB-native yet.

### 3. DB Data Availability Findings (RDS/Aurora)
- DB cost and fact pipelines exist:
  - `db_cost_history_daily`
  - `fact_db_resource_daily`
- Cost category separation exists (`compute`, `storage`, `io`, `backup`, `data_transfer`, etc.).
- DB inventory/utilization table structures exist, but scan flagged uncertainty on production writer/ingestion reliability for:
  - `db_resource_inventory_snapshots`
  - `db_utilization_daily`

### 4. Identity Model Findings
- Resource identity includes ARN-pattern-based type handling (`instance` vs `cluster`).
- Synthetic IDs for scoped/unattributed records were identified and flagged as non-actionable for recommendation targeting.
- Explorer ? Assets ? Detail linkage appears available for attaching recommendations when identity is stable.

### 5. Savings Feasibility Findings
- Monthly savings reasoning is feasible for cost-driven recommendations using existing DB cost/fact tables.
- Aurora shared-cost allocation remains a caution area for high-confidence recommendation math.

### 6. Processing Architecture Findings
- DB cost history rebuild is already tied to ingestion finalization flow.
- Async scheduler patterns exist for recommendation sync/action processors.
- Important operational note from scan: some optimization schedulers are present in code but commented in bootstrap, so runtime behavior depends on deployment/startup configuration.

### 7. UI/UX Integration Findings
- Database Explorer/Assets/Detail routes and API contracts already exist in frontend and backend.
- DB asset/detail views already expose recommendation count and optimization-readiness style signals, making v1 surfacing path reusable.

### 8. Risk and Readiness Conclusions
- Some recommendation categories are feasible now (especially cost-heavy/storage-oriented).
- Utilization-dependent categories are riskier without stronger telemetry coverage guarantees.
- Key prerequisites identified before implementation:
  - solidify DB inventory/utilization ingestion reliability
  - recommendation eligibility filters for actionable resource identities
  - DB-specific recommendation generation module
  - confidence thresholds and sparse-signal handling

## Output Style and Positioning
- The final scan report was produced as architecture-focused and evidence-driven.
- Findings were explicitly grounded in repository structures, models, migrations, services, routes, and query layers.

## Outcome
This chat produced both:
- a reusable **discovery scan prompt**, and
- a concrete **foundation scan report** suitable for planning Database Recommendations v1 scope and prerequisites.
