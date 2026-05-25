# 21 - Database AWS Phase Scans, IAM Role Template Updates, and DB Engine Unknown Debug/Fix

## Chat Scope
This chat covered deep scan/validation and implementation checkpoints for KCX Database AWS integration, then moved into IAM/CloudFormation permission readiness, CloudWatch operational signal persistence, Phase-1F utilization surfacing, and final DB Explorer `Unknown` engine debugging/fixes.

---

## 1) Checkpoint and Phase Scan Work

### Requested Scan Areas
- Database AWS foundation module structure (`aws/clients`, `credentials`, `regions`, `errors`, `types`, `utils`, exports)
- Phase-1B RDS/Aurora inventory adapter and normalization
- Phase-1C inventory snapshot persistence and `is_current` handling
- Phase-1D assets live-inventory visibility fields
- Phase-1E CloudWatch metrics adapter/persistence/backfill verification
- Phase-2 database actions status scan (confirm not implemented)
- Scripts and validation inventory

### Deliverable Created
- `backend/docs/database-current-implementation-checkpoint.md`

---

## 2) Diagnostic Script for Valid Tenant/Cloud Connections

### Problem
CloudWatch backfill failed with:
- `Cloud connection not found`
- Provided tenant/cloud connection IDs did not resolve in current DB.

### Deliverable Created
- `backend/scripts/find-db-cloud-connections.ts`

### Script Behavior
- Read-only DB diagnostic using current env/DB URL.
- Lists candidate cloud connection records used by the DB AWS credential resolver.
- Prints masked/safe fields (no secret exposure).
- Summarizes current inventory presence from `db_resource_inventory_snapshots` (`is_current=true`) grouped by tenant/cloud/service/resource type.
- Marks which connections are eligible for metrics backfill based on current inventory presence.

### Validation
- Backend TypeScript build executed successfully.

---

## 3) AWS Onboarding / CloudFormation Role Architecture Scan

### Scan Goal
Understand role/template flow before permission changes.

### Covered
- CloudFormation templates used by onboarding.
- Billing/read role vs other roles (including intended action role usage path).
- Which ARN is persisted in cloud connection records.
- Which role is used for:
  - billing/CUR ingestion
  - live inventory
  - CloudWatch metrics backfill
  - future DB actions
- Static vs dynamic template generation.
- Template update application path (stack update flow).
- Code files controlling template creation/onboarding.
- Minimal permission deltas required for RDS/Aurora discovery + CloudWatch metrics.

---

## 4) Billing Role Template Permission Patch

### File Patched
- `backend/src/templates/billing-export.yaml`

### Added Read-Only Permissions
- `rds:DescribeDBInstances`
- `rds:DescribeDBClusters`
- `elasticache:DescribeCacheClusters`
- `elasticache:DescribeReplicationGroups`
- `cloudwatch:GetMetricData`
- `cloudwatch:GetMetricStatistics`
- `cloudwatch:ListMetrics`

### Guardrails Followed
- No trust policy changes
- No output/callback payload changes
- No runtime/backend logic changes
- No action-role changes
- No migration changes

### Validation
- YAML checked in-file and backend build validation performed in flow.
- Impact scope clarified: applies on CloudFormation stack update, not immediate runtime mutation.

---

## 5) Live Operational Signal Persistence Validation (Phase-1E)

### Context Validated
- Inventory sync + STS assume-role path worked.
- CloudWatch metric backfill persisted live signals into `db_utilization_daily` (49 rows noted).

### Inspection Focus
- `db_utilization_daily` schema usage and linkage.
- Backend repository/API consumption vs gaps.
- Frontend Assets/Detail operational data visibility.
- Readiness classification across financial/inventory/operational/recommendation/action layers.

### Outcome
- Confirmed operational data persistence existed.
- Identified consumption gap areas where Assets/Detail still leaned on fact tables without full util-first preference.

---

## 6) Phase-1F Design and Implementation (Utilization Surfacing)

### Design Scan Requested
Planned minimal change to surface util metrics from `db_utilization_daily` in existing Assets/Detail APIs without API contract breakage.

### Implemented Scope (Backend)
- Primary file changed:
  - `backend/src/features/database/assets/assets.repository.ts`

### Implemented Patterns
- Added utilization-serving CTE chain:
  - scoped util
  - aggregated util
  - latest util
  - daily util for trends
- Operational field precedence:
  - `COALESCE(util_metric, fact_metric)`
- Null preservation enforced:
  - no fake zero for missing CPU/connections
  - IOPS/throughput null-aware read+write summation
- Financial/cost metrics retained from fact/cost layers.
- No frontend changes.
- No migrations/new tables.

### Validation
- Backend build passed after implementation.

---

## 7) DB Explorer Regression: `Unknown` Engine Appearing Instead of MySQL

### User Symptom
DB Explorer GroupBy `DB Engine` showed `Unknown` when expected `mysql`; behavior had changed from earlier in the day.

### Root Cause Found
- Fact rows had literal sentinel value `db_engine='Unknown'`.
- Inventory had real engine (`mysql`) for same resource.
- Existing fallback only handled null/blank, not sentinel `'Unknown'`.
- Additional inconsistency: values preview/filter list used fact-only engine extraction path.

### Files Patched
- `backend/src/features/database/explorer/explorer.repository.ts`

### Fixes Applied
1. `db_engine` group-by label/key expressions:
   - Treat `'unknown'` as missing.
   - Fallback to `latest_inventory.db_engine`.
2. `latest_inventory` CTE:
   - Included `db_engine` in selected columns.
3. `db_engine` grouped path:
   - `requiresInventory=true` so fallback source is actually joined.
4. DB Engine values preview/filter options query:
   - Switched to fact+inventory fallback logic (not fact-only).
   - Excluded unresolved rows only after fallback resolution.

### Verification
- Backend build passed.
- Direct DB check confirmed engine set includes:
  - `aurora postgresql`
  - `mysql`
  - `redis`

---

## Net Outcome of This Chat
- Completed broad multi-phase Database module checkpointing and architecture validation.
- Added safe diagnostic tooling for cloud connection resolution.
- Unblocked DB inventory/metrics IAM read permissions in billing onboarding template.
- Implemented Phase-1F util surfacing in Assets/Detail backend.
- Fixed DB Explorer engine resolution regression so `mysql` is no longer hidden by fact sentinel `Unknown` values.

## Final Notes
- If UI still temporarily shows stale values after backend fixes, restart backend process and hard refresh frontend to clear cached state.
