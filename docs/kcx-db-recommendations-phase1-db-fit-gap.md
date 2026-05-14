# KCX Database Recommendations v1 - Phase 1 DB Fit/Gap Scan

## 1. Executive Summary

- **Can DB Recommendations v1 reuse existing schema?** **Yes, for recommendation records** in `fact_recommendations`.
- **Is migration needed?** **Minor migration recommended** for query/index readiness (not for new columns/table shape).
- **Recommended DB-phase decision:** Reuse `fact_recommendations` for DB recommendations (RDS/Aurora), keep `fact_recommendation_actions` out of scope for DB v1 execution, and add one generic recommendations index for expected DB list/sync workloads.

Key evidence:
- `fact_recommendations` already has all required core identity/cost/text/evidence/status fields used by current recommendation systems.
- DB source tables (`fact_db_resource_daily`, `db_cost_history_daily`, `db_resource_inventory_snapshots`, `db_utilization_daily`) already exist with DB-oriented cost/inventory/utilization semantics.
- Action workflows are currently EC2-remediation oriented and rely on `fact_recommendation_actions` action semantics not needed for DB v1 (view + ignore lifecycle).

## 2. Existing Recommendation Schema Fit

Target table: `fact_recommendations` (model: `backend/src/models/billing/fact_recommendations.ts`)

### Required field fit

All requested fields are representable in current schema:

- `tenant_id` -> `tenantId` (UUID, required)
- `cloud_connection_id` -> `cloudConnectionId` (UUID, nullable)
- `billing_source_id` -> `billingSourceId` (BIGINT, nullable)
- `aws_account_id` -> `awsAccountId` (STRING(50), required)
- `aws_region_code` -> `awsRegionCode` (STRING(50), nullable)
- `service_key` -> `serviceKey` (BIGINT, nullable)
- `sub_account_key` -> `subAccountKey` (BIGINT, nullable)
- `region_key` -> `regionKey` (BIGINT, nullable)
- `resource_id` -> `resourceId` (STRING(255), nullable)
- `resource_arn` -> `resourceArn` (TEXT, nullable)
- `resource_name` -> `resourceName` (STRING(255), nullable)
- `resource_type` -> `resourceType` (STRING(100), nullable)
- `category` -> `category` (STRING(50), required)
- `recommendation_type` -> `recommendationType` (STRING(100), required)
- `current_monthly_cost` -> `currentMonthlyCost` (DECIMAL(18,4), required default 0)
- `estimated_monthly_savings` -> `estimatedMonthlySavings` (DECIMAL(18,4), required default 0)
- `projected_monthly_cost` -> `projectedMonthlyCost` (DECIMAL(18,4), required default 0)
- `recommendation_title` -> `recommendationTitle` (STRING(255), nullable)
- `recommendation_text` -> `recommendationText` (TEXT, nullable)
- `observation_start` -> `observationStart` (DATE, nullable)
- `observation_end` -> `observationEnd` (DATE, nullable)
- `metadata_json` -> `metadataJson` (JSONB, nullable)
- `detected_at` -> `detectedAt` (DATE, nullable)
- `last_seen_at` -> `lastSeenAt` (DATE, nullable)
- `status` -> `status` (STRING(20), required default `OPEN`)

### Schema limitations

- `resource_id` is nullable in schema, but DB recommendation identity should treat it as mandatory for actionable resource records.
- No built-in enum/check for category/type/status; validation is backend responsibility.
- No generic uniqueness constraint preventing duplicate recommendation identity rows.
- Existing specialized indexes are mostly EC2/path-specific; generic DB recommendation query patterns are under-indexed.

## 3. DB Resource Identity Fit

### Can DB recommendations attach to RDS/Aurora resources?

Yes, with caveats.

Evidence from DB pipelines (`backend/src/features/billing/services/db-cost-history.service.ts` + DB models):
- `fact_db_resource_daily.resource_id` can be:
  - RDS/Aurora ARN-like IDs (`arn:aws:rds:...:db:...`, `arn:aws:rds:...:cluster:...`)
  - synthetic scoped IDs (`db-scope:AmazonRDS`)
  - synthetic unattributed IDs (`db-unattributed:AmazonRDS|<date>|<cost_category>`)
- `resource_type` inference in fact build:
  - `instance` for ARN containing `:db:`
  - `cluster` for ARN containing `:cluster:`
  - `scoped` for `db-scope:AmazonRDS`

### Identity dimensions and linkage

- Region/account linkage is available via `region_key`, `sub_account_key`, `aws_region_code`/`aws_account_id` derived in recommendation path.
- Connection/source linkage exists via `cloud_connection_id` and `billing_source_id` in DB facts and recommendation table.
- Inventory linkage exists through `db_resource_inventory_snapshots` keyed by `tenant_id`, `cloud_connection_id`, `resource_id`.

### Eligibility rule recommendation

For DB Recommendations v1 eligibility:
- Include only records where all are true:
  - `resource_id` is non-null/non-empty
  - `resource_id NOT LIKE 'db-scope:%'`
  - `resource_id NOT LIKE 'db-unattributed:%'`
  - `db_service` in relational scope (RDS/Aurora mapping)
  - `cloud_connection_id` is non-null
  - `billing_source_id` is non-null (for financial explainability lineage)
- Prefer `resource_arn` when present; fallback to stable `resource_id`.

## 4. Recommendation Category / Type Fit

### DB schema limitations

- `category` is `STRING(50)` and `recommendation_type` is `STRING(100)` with no enum/check constraints.
- Proposed DB values fit length and type constraints:
  - `DB_STORAGE_OPTIMIZATION`
  - `DB_IDLE_CANDIDATE`
  - `DB_HA_COST_OPTIMIZATION`
  - `DB_ENGINE_DEPLOYMENT_OPTIMIZATION`
  - `DB_RIGHTSIZING_CANDIDATE`

### Backend logic limitations

Current optimization backend has hardcoded category behavior:
- predicates and flows are centered on `RIGHTSIZING`, `IDLE`, `COMMITMENT`
- overview/list/detail APIs are category-specific for those three
- execute flows and sync handlers assume EC2/idle/commitment semantics

So this is not a table-schema blocker, but a backend-path blocker (Phase 2 concern).

### Naming convention recommendation

Use uppercase stable taxonomy:
- `category`: `DB`
- `recommendation_type`: one of
  - `DB_STORAGE_OPTIMIZATION`
  - `DB_IDLE_CANDIDATE`
  - `DB_HA_COST_OPTIMIZATION`
  - `DB_ENGINE_DEPLOYMENT_OPTIMIZATION`
  - `DB_RIGHTSIZING_CANDIDATE`

This avoids collision with current `RIGHTSIZING/IDLE/COMMITMENT` categories and keeps DB recommendations queryable as one family.

## 5. Evidence / Metadata Fit

### Field fit

- `metadata_json` (JSONB): best fit for structured explainability/evidence payload.
- `raw_payload_json` (TEXT): currently used for vendor payload capture in existing sync paths; not ideal for first-class explainability schema.
- `recommendation_text`: good for concise human summary.
- `idle_reason`, `idle_observation_value`: specific to legacy idle style; optional for DB idle-like recommendations but not required for all DB types.
- `observation_start`/`observation_end`: fit observation window semantics for cost/utilization evidence.

### Proposed `metadata_json` structure (DB v1)

```json
{
  "confidence": "high|medium|low",
  "confidence_reason": "short explainable reason",
  "evidence_level": "billing_only|inventory_backed|telemetry_backed",
  "cost_breakdown": {
    "current_monthly_cost": 0,
    "components": {
      "compute": 0,
      "storage": 0,
      "io": 0,
      "backup": 0,
      "data_transfer": 0,
      "tax": 0,
      "credit": 0,
      "refund": 0
    }
  },
  "signals_used": ["list of used signals"],
  "signals_missing": ["list of missing signals"],
  "data_quality_warnings": ["lineage or quality warnings"],
  "savings_assumptions": ["assumptions used in estimated savings"],
  "eligibility_reason": "why this row was eligible",
  "source_tables": [
    "fact_db_resource_daily",
    "db_cost_history_daily",
    "db_resource_inventory_snapshots",
    "db_utilization_daily"
  ],
  "generated_by": {
    "module": "database-recommendations-v1",
    "phase": "phase-1-db",
    "version": "v1"
  }
}
```

### `raw_payload_json` usage recommendation

- For DB v1, prefer `metadata_json` as canonical evidence.
- Use `raw_payload_json` only if there is a concrete raw upstream blob to preserve for audit/debug.
- Do not rely on `raw_payload_json` for primary API explainability rendering.

## 6. Financial Impact Fit

Current financial fields support DB recommendation impact modeling:
- `current_monthly_cost`
- `estimated_monthly_savings`
- `projected_monthly_cost`

Fit by recommendation type:
- Storage optimization: supported
- Backup optimization: supported
- I/O optimization: supported
- Idle cost candidates: supported
- HA cost optimization: supported
- Engine/deployment informational optimization: supported (set savings to 0 where financially non-quantified)

Guidance for informational recommendations:
- `estimated_monthly_savings = 0` is acceptable when explicitly marked in `metadata_json` (`confidence_reason`, `savings_assumptions`) and phrased as informational/opportunity qualification, not guaranteed savings.

## 7. Lifecycle / Status Fit

### Supported statuses in active code paths

Observed recommendation statuses:
- `OPEN`
- `NO_ACTION_NEEDED`
- `IN_PROGRESS`
- `APPLIED`
- `FAILED`
- `IGNORED`

Additional lifecycle fields in schema:
- `status_reason`
- `snoozed_until`
- `status_updated_at`
- `status_updated_by`
- `detected_at`
- `last_seen_at`

### Fit for DB recommendations

- DB recommendations can use existing status model without schema changes.
- Ignore-preservation behavior exists in current sync design pattern (ignored records retained; open regenerated records replaced).
- `detected_at`/`last_seen_at` are suitable for regeneration tracking and staleness semantics.

Constraint note:
- No DB-level status enum/check; backend must enforce allowed transitions.

## 8. Action Table Fit

`fact_recommendation_actions` appears **generic in table naming**, but usage is currently **EC2/idle execution oriented**:
- rightsizing action columns/flows require `instance_id`, `from_instance_type`, `to_instance_type`
- idle action flows require EC2-specific action types (`APPLY_IDLE_DELETE_EBS`, etc.)
- execute processors call AWS EC2 mutation helpers

Additional finding:
- The repository has code references to `fact_recommendation_actions`, but no local Sequelize model/migration that defines this table shape.

Recommendation for DB v1:
- **Do not use action execution for DB Recommendations v1**.
- Keep DB recommendations as investigate/view + lifecycle state actions (especially ignore/review) via `fact_recommendations` status.
- If DB execution/remediation is ever needed later, define a dedicated action contract in Phase 2/3+.

## 9. DB Source Table Readiness

### `fact_db_resource_daily`
- Purpose: daily DB resource-level rolled-up cost + some operational attributes.
- Useful fields: `resource_id`, `resource_arn`, `resource_type`, `db_service`, `db_engine`, `cluster_id`, `compute_cost`, `storage_cost`, `io_cost`, `backup_cost`, `total_effective_cost`, `region_key`, `sub_account_key`, `cloud_connection_id`, `billing_source_id`.
- Reliability: good for billing-backed cost decomposition; includes synthetic IDs that must be filtered.
- Gaps: includes scope/unattributed synthetic rows; limited deep config telemetry.
- Evidence level support: billing_only and partially inventory_backed.

### `db_cost_history_daily`
- Purpose: normalized daily DB cost history by resource and cost category.
- Useful fields: `resource_id`, `cost_category`, `effective_cost`, `billed_cost`, `usage_date`, `db_service`, `db_engine`.
- Reliability: strong for financial explainability and component attribution.
- Gaps: attribution can fallback to synthetic IDs when CUR resource linkage is missing.
- Evidence level support: billing_only.

### `db_resource_inventory_snapshots`
- Purpose: inventory/config snapshot for DB resources.
- Useful fields: `resource_id`, `resource_arn`, `resource_name`, `resource_type`, `instance_class`, `capacity_mode`, `cluster_id`, `allocated_storage_gb`, `status`, `is_cluster_resource`, `tags_json`, `metadata_json`.
- Reliability: good for identity/config and explainability when available.
- Gaps: may be null/stale for some resources depending on sync coverage.
- Evidence level support: inventory_backed.

### `db_utilization_daily`
- Purpose: daily utilization metrics for DB resources.
- Useful fields: `cpu_avg`, `cpu_max`, `connections_avg/max`, `read_iops`, `write_iops`, `throughput`, `storage_used_gb`, `allocated_storage_gb`, `metric_source`, `sample_count`.
- Reliability: useful where populated; may be incomplete by resource/date.
- Gaps: metric completeness variability.
- Evidence level support: telemetry_backed (with caveats).

### Feasibility matrix

- Storage Optimization: **feasible now** (billing + inventory)
- Idle/Underutilized DB Candidates: **feasible with caveats** (needs utilization coverage checks; fallback to billing-only confidence downgrade)
- HA Cost Optimization: **feasible with caveats** (depends on reliable topology/config signals)
- Engine/Deployment Optimization: **feasible with caveats** (often informational unless cost delta assumptions are robust)
- Rightsizing Candidates: **defer** for strict/high-confidence automation; **feasible with caveats** for advisory-only candidates

## 10. Index / Query Readiness

Expected operations:
- list by tenant/cloud_connection/status/category
- count open by DB resource
- detail by recommendation id
- sync replacement/upsert-like identity handling
- duplicate prevention

Current state:
- `fact_recommendations` has EC2-era/partial indexes (`idx_fact_recommendations_ec2_identity_status`, `idx_fact_recommendations_ec2_v1_lookup`) that do not fully match DB recommendation query patterns.
- No generic uniqueness index for recommendation identity.

### Recommended new index

Add one generic read/sync index:

```sql
CREATE INDEX IF NOT EXISTS idx_fact_recommendations_tenant_conn_category_status
ON fact_recommendations (
  tenant_id,
  cloud_connection_id,
  category,
  status,
  updated_at DESC
);
```

Why:
- Directly supports list/filter operations expected for DB recommendations.
- Helps open-count queries by status/category/connection.
- Non-invasive and compatible with existing schema.

Optional future hardening (not required for Phase 1):
- consider a separate identity index for de-dup/upsert workloads once DB recommendation identity contract is finalized.

## 11. Final Migration Decision

**Option B: Minor migration required**

Reason:
- Existing table structures are sufficient for DB recommendations.
- But index readiness is not ideal for DB recommendation query patterns; add a generic index on `fact_recommendations`.
- No new table or new required columns needed for DB v1 scope.

## 12. Recommended DB Phase Scope

Phase 1 DB should:
- Reuse existing `fact_recommendations` table for DB recommendation persistence.
- Add **index only** (as above) for recommendation list/count performance.
- Define DB recommendation identity/eligibility rules at data-contract level:
  - exclude `db-scope:*` and `db-unattributed:*`
  - require valid tenant/connection/source/account/region/resource lineage.

What waits for Phase 2 Backend:
- New DB recommendation sync/generation service.
- DB category/type aware list/detail APIs.
- lifecycle transition rules for DB recommendation UX semantics.
- metadata rendering and confidence/evidence presentation.

## 13. Open Questions Before Backend Phase

1. For Aurora, should recommendation identity be emitted at **cluster** level, **instance** level, or both (with dedupe precedence)?
2. Is `category='DB'` + DB-specific `recommendation_type` the agreed taxonomy, or should DB types map into existing high-level categories (`RIGHTSIZING`/`IDLE`)?
3. What minimum lineage is mandatory to publish a DB recommendation: must `cloud_connection_id` and `billing_source_id` both be present?
4. For informational recommendations (engine/deployment), should UI show them in same list as savings recommendations or a separate informational bucket?
5. What confidence threshold is required before emitting telemetry-backed rightsizing recommendations when utilization coverage is partial?
