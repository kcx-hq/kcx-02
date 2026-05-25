# 29 - DB Recommendations Phase-2 Orchestration, Verification, and Dev-Seeded Runtime Validation

## Chat Scope
This chat covered end-to-end backend work for KCX Database Recommendations (RDS/Aurora), including:
- Phase-2 backend foundation architecture
- Evidence/explainability contract hardening
- Rule implementation sequence (`DB_STORAGE_OPTIMIZATION`, `DB_IDLE_CANDIDATE`, `DB_HA_COST_OPTIMIZATION`, `DB_ENGINE_DEPLOYMENT_OPTIMIZATION`)
- API polish/integration
- Orchestration and post-ingestion sync integration
- Runtime verification and lifecycle semantics validation
- Dev-only seeded data harness to force real recommendation generation through actual pipeline

---

## 1) Module Placement and Structure Corrections

### Path correction and relocation direction
- A malformed folder path (`services\database\recommendations`) was identified and corrected.
- Recommendation module was aligned under:
  - `backend/src/features/database/recommendations/`
- Routing remained under existing `/services/database/recommendations` API paths (route path convention preserved).

### Scope constraints respected
- No new recommendation schema introduced.
- No frontend changes during backend phases.
- No fake telemetry logic.

---

## 2) Prompt-1 Foundation (Backend Skeleton)

Implemented DB recommendation module skeleton:
- `db-recommendations.routes.ts`
- `db-recommendations.controller.ts`
- `db-recommendations.service.ts`
- `db-recommendations.generator.ts`
- `types/`, `rules/`, `builders/`, `utils/` foundations

Key requirements implemented:
- DB category isolation (`category = 'DB'`)
- List/detail/summary/generate endpoints
- Eligibility, identity, dedupe utilities
- No-op/placeholder rules initially
- `fact_recommendations` reuse only (no new tables)

---

## 3) Prompt-2 Evidence System

Evidence contract was standardized via `metadata_json` with:
- `version`, `generated_by`, `generated_at`
- `confidence`, `confidence_score`
- `evidence_level`
- `signals_used`, `signals_missing`
- `cost_breakdown`, `savings_assumptions`
- `data_quality_warnings`
- `source_tables`
- `lineage`
- `rule_context`

Implemented deterministic confidence logic and evidence-level rules:
- billing/inventory/telemetry evidence weighting
- warning/missing-signal penalties
- capping behavior for warning severity

Backward tolerance added for malformed/legacy metadata parsing in APIs.

---

## 4) Prompt-3 to Prompt-6 Rule Implementation

### Implemented rules
1. `DB_STORAGE_OPTIMIZATION`
2. `DB_IDLE_CANDIDATE`
3. `DB_HA_COST_OPTIMIZATION`
4. `DB_ENGINE_DEPLOYMENT_OPTIMIZATION`

### Implementation themes
- Conservative, advisory wording
- Billing-first and sparse-aware behavior
- No fake savings
- No destructive/operational automation recommendations
- Deduped identity and upsert-in-place

---

## 5) Prompt-7 API Polish

List endpoint improvements:
- Optional filters for status/type/confidence/evidence/resource/connection/region/engine/resourceType/search
- Pagination and sorting defaults
- DB-only response isolation

Detail endpoint:
- Safe metadata parsing and evidence expansion
- Lifecycle fields + evidence payload exposed

Summary endpoint:
- `total`, `byStatus`, `byType`, `byConfidence`, `byEvidenceLevel`
- warnings count, active/resolved counts, savings totals, `lastGeneratedAt`

Generate endpoint:
- Structured operation result payload with counts and rule summaries.

---

## 6) Prompt-8 Orchestration / Sync Integration

Integration location selected from existing architecture:
- Post-ingestion hook in:
  - `backend/src/features/billing/services/ingestion-orchestrator.service.ts`

Added DB sync call in same guarded pattern as existing optimization sync calls:
- DB recommendation sync failures do not fail ingestion completion
- Logging remains lightweight and operational

Generator orchestration hardening:
- Per-rule failure isolation (one rule failure does not crash full cycle)
- Structured rule-level timing/failure reporting
- Idempotent upsert and stale resolution preserved

---

## 7) Lifecycle Semantics Verification (Stale Resolution Status)

Concern raised:
- Whether stale recommendations should be marked `COMPLETED`.

Outcome after cross-module inspection:
- `COMPLETED` is already used as stale terminal state in DB/EC2/load-balancer recommendation generators.
- No better universally adopted stale terminal status was found for this flow.
- Decision: keep `COMPLETED` for DB stale resolution to remain platform-consistent.

---

## 8) Runtime Verification Findings

Initial runtime checks:
- Build passed.
- Routes were registered correctly.
- Generation executed safely but returned zero recommendations due to data state:
  - actionability filtered out all rows (`totalEffectiveCost <= 0`)
  - scoped/non-attributed exclusions also active.

This led to a dev-only seeded validation request.

---

## 9) Dev-Only Seeded Validation Harness (Real Pipeline)

Implemented scripts:
1. `backend/scripts/verify-db-recommendations-dev-seeded.ts`
2. `backend/scripts/cleanup-db-recommendations-dev-seeded.ts`

Purpose:
- Seed minimal, clearly identifiable DB source facts for one valid resource
- Trigger real generator pipeline (not direct recommendation inserts)
- Validate list/summary/detail outputs and idempotency
- Provide deterministic cleanup

Seeded resource:
- `arn:aws:rds:us-east-1:231016597055:db:kcx-dev-recommendation-test`

Validation outcome:
- `DB_STORAGE_OPTIMIZATION` generated successfully on run 1 (`created=1`)
- second run idempotent (`created=0`, `updated=1`)
- no duplicate active rows
- evidence payload complete (signals/lineage/rule_context/source_tables)
- confidence reasonable (`medium`)
- evidence level reasonable (`inventory_backed`)
- savings basis `not_estimated`

---

## 10) Important Fix During Seeded Validation

Discovered a contract mismatch:
- `null` savings values were being coerced to `0` in evidence normalization.

Fix applied:
- Updated numeric normalizer in evidence builder to preserve `null` inputs.

Result after fix:
- `estimated_monthly_savings: null`
- `estimated_savings_percent: null`
- `basis: not_estimated`

This restored alignment with recommendation evidence expectations.

---

## 11) Net Outcome of This Chat

- DB Recommendations Phase-2 backend architecture and lifecycle are implemented and integrated.
- Rules (except rightsizing) are wired and operational.
- API contract is frontend-ready and filterable.
- Post-ingestion orchestration hook is in place and safe.
- Stale lifecycle semantics are consistent with current platform use (`COMPLETED`).
- A reproducible dev-only runtime harness exists to generate and validate real DB recommendation objects end-to-end.

