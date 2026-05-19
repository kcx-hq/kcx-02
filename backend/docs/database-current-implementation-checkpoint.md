# Database Current Implementation Checkpoint

Date: 2026-05-18  
Scope: KCX backend database module AWS integration + database actions scan (inspection only)

## Completed

### 1) Database AWS foundation
- Implemented AWS DB foundation module at `backend/src/features/database/aws/` with:
  - typed client context and service-kind mapping
  - role-based credentials resolver (STS assumeRole)
  - region resolver with fallback chain and default `us-east-1`
  - AWS error normalization into DB-specific error classes
  - pagination/string/ARN utilities
  - module-level exports wired through `index.ts` files
- CloudWatch client support is integrated in the same client factory (`kind: "cloudwatch"`).

### 2) Phase-1B RDS/Aurora inventory
- RDS/Aurora adapter exists and is implemented:
  - calls `DescribeDBInstances`
  - calls `DescribeDBClusters`
  - paginates both calls via shared paginator util
- Normalized DTOs exist and are mapped for:
  - instance resources (`db_instance`)
  - cluster resources (`db_cluster`)
- Verifier script exists for fetch/preview.

### 3) Phase-1C inventory persistence
- Persistence into `db_resource_inventory_snapshots` is implemented.
- `isCurrent` lifecycle behavior is implemented transactionally:
  - marks existing current rows to `isCurrent=false` for same `(tenant, connection, resourceId)`
  - inserts new rows as `isCurrent=true`
- Mapper from normalized inventory DTOs to persistable snapshot rows is implemented.
- Sync orchestrator supports `dryRun` and persist modes.
- Verifier script exists for both dry-run and persist flow.

### 4) Phase-1D Assets visibility
- `assets.types.ts` includes live inventory/provenance fields:
  - `hasLiveInventory`
  - `inventorySource`
  - `inventoryObservedAt`
  - `inventoryFreshnessMinutes`
- `assets.repository.ts` reads from latest inventory snapshot CTE and computes/returns those fields for list + detail payloads.
- Repository also surfaces inventory-derived operational metadata (endpoint, multi-AZ, storage encryption, deletion protection, backup retention).

### 5) Phase-1E CloudWatch metrics
- CloudWatch metrics adapter is implemented for RDS/Aurora using `GetMetricData`.
- Metrics normalization is implemented (CPU, connections, IOPS, throughput, storage signals).
- Persistence into `db_utilization_daily` is implemented via bulk upsert (`updateOnDuplicate`).
- Sync runner exists with dry-run and persist behavior.
- Backfill runner exists (days window, up to max 31) and supports:
  - snapshot-driven resource set (`isCurrent=true` inventory)
  - dry-run vs persist
  - role-based auth and env static credentials mode
- Verifier scripts exist for metrics preview/persist and backfill.

## Partially completed

### 6) Database actions Phase-2 scan
- `database-actions-phase-2-scan.md` is **not present** in `backend/docs` (or elsewhere in repository search).
- No dedicated Database Actions module/routes/controllers/executors were found under `backend/src/features/database`.
- Current DB feature routes are explorer/assets/recommendations only.

Interpretation:
- Action *preconditions* and role source plumbing exist (billing/action role selection), but **actual DB action execution implementation has not started**.

### Validation status (partial)
- Implementation appears present for inventory + persistence + assets visibility + metrics + backfill.
- Runtime validation still depends on environment checks (permissions, CloudWatch metric availability by engine/deployment, real data coverage, idempotency under repeated runs).

## Not started
- Phase-2 database actions implementation (action APIs, action execution engine, safety gates, action audit trail, run status lifecycle).
- Formal Phase-2 scan artifact file (`database-actions-phase-2-scan.md`).

## Important files

### AWS foundation
- `backend/src/features/database/aws/index.ts`
- `backend/src/features/database/aws/types/db-aws.types.ts`
- `backend/src/features/database/aws/clients/db-aws-client.factory.ts`
- `backend/src/features/database/aws/credentials/db-aws-credentials.resolver.ts`
- `backend/src/features/database/aws/regions/db-aws-region.resolver.ts`
- `backend/src/features/database/aws/errors/db-aws.errors.ts`
- `backend/src/features/database/aws/errors/db-aws-error-normalizer.ts`
- `backend/src/features/database/aws/utils/db-aws-pagination.utils.ts`
- `backend/src/features/database/aws/utils/db-aws-arn.utils.ts`

### Inventory + persistence
- `backend/src/features/database/aws/inventory/rds-aurora/rds-aurora-inventory.adapter.ts`
- `backend/src/features/database/aws/inventory/rds-aurora/rds-aurora-inventory.types.ts`
- `backend/src/features/database/aws/inventory/rds-aurora/rds-aurora-inventory.persistence.mapper.ts`
- `backend/src/features/database/aws/inventory/rds-aurora/rds-aurora-inventory.persistence.ts`
- `backend/src/features/database/aws/inventory/rds-aurora/rds-aurora-inventory.sync.ts`

### Assets visibility
- `backend/src/features/database/assets/assets.types.ts`
- `backend/src/features/database/assets/assets.repository.ts`

### Metrics + backfill
- `backend/src/features/database/aws/metrics/rds-aurora/rds-aurora-metrics.adapter.ts`
- `backend/src/features/database/aws/metrics/rds-aurora/rds-aurora-metrics.types.ts`
- `backend/src/features/database/aws/metrics/rds-aurora/rds-aurora-metrics.persistence.ts`
- `backend/src/features/database/aws/metrics/rds-aurora/rds-aurora-metrics.sync.ts`
- `backend/src/features/database/aws/metrics/rds-aurora/rds-aurora-metrics.backfill.ts`

### Feature route surface
- `backend/src/features/database/database.routes.ts`

## Important scripts

- `backend/scripts/verify-db-aws-rds-aurora-inventory.ts`
  - Verifies inventory fetch only (no persistence), prints summary and sample table.

- `backend/scripts/verify-db-aws-rds-aurora-inventory-persist.ts`
  - `--dry-run`: fetch + map preview only.
  - persist mode: executes inventory sync and snapshot persistence.

- `backend/scripts/verify-db-aws-rds-aurora-metrics.ts`
  - Preview mode: fetches inventory + CloudWatch metrics and prints sample metric rows.
  - `--persist`: runs sync and writes `db_utilization_daily`.

- `backend/scripts/verify-db-aws-rds-aurora-metrics-backfill.ts`
  - Backfills daily metrics from current inventory snapshots over N days.
  - Supports dry-run/persist and auth-mode (`assume-role` or `env-creds`).

## Tables touched

Primary tables touched by implemented AWS DB integration:
- `db_resource_inventory_snapshots`
  - writes from inventory persistence and reads in assets/metrics-backfill.
- `db_utilization_daily`
  - writes from metrics sync/backfill; read by recommendation pipelines.

Downstream read-side tables used in assets/recommendations context:
- `fact_db_resource_daily`
- `db_cost_history_daily`
- `fact_recommendations`
- `dim_region`
- `dim_sub_account`

## What data is now available
- Live AWS-discovered RDS/Aurora inventory snapshots (instance + cluster metadata, topology hints, tags/metadata JSON).
- Current inventory markers (`isCurrent`) and historical snapshots by `discoveredAt`.
- CloudWatch-derived daily utilization signals for RDS/Aurora:
  - CPU avg/max
  - connections avg/max
  - read/write IOPS
  - read/write throughput
  - derived storage used (when available)
- Assets API payload enrichment with inventory provenance/freshness and infrastructure context fields.

## What still needs validation
- IAM permission coverage in real tenants:
  - `DescribeDBInstances`, `DescribeDBClusters`, CloudWatch `GetMetricData`.
- Regional correctness and multi-region assumptions (current fetch uses resolved single region context).
- CloudWatch metric completeness by engine/type (Aurora cluster vs instance dimension behavior).
- Snapshot and utilization idempotency under repeated scheduled runs at scale.
- Freshness/lag expectations in assets endpoints after sync jobs.

## Exact next recommended step
1. Run a controlled end-to-end validation for one tenant+connection in this exact order:
   - inventory dry-run
   - inventory persist
   - metrics dry-run
   - metrics persist
   - metrics backfill dry-run (7 days)
   - metrics backfill persist (7 days)
   Then verify row-level outcomes in `db_resource_inventory_snapshots` and `db_utilization_daily`, and capture results into a new `backend/docs/database-actions-phase-2-scan.md` so Phase-2 can start from a confirmed baseline.
