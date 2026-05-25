# Dev DB Cleanup, Offline Parquet Reseed, and DB-Family Scope Guard

## Summary
This chat focused on a dev-only database data reset/reseed workflow using an offline CUR parquet file from a different AWS account, while preserving tenant/auth/admin/runtime connection entities and avoiding non-DB module data deletion.

## Topics Covered
1. Scoped cleanup of stale DB-module seeded data in dev:
- Identified active scope:
  - `tenant_id = 65020dec-5d2b-436a-b21a-182ad8703218`
  - `cloud_connection_id = 94f94455-9c4e-4dd8-9c57-878cada99ced`
  - `billing_source_id = 1`
  - `provider_id = 1`
- Cleaned DB tables only (scoped):
  - `fact_cost_line_items` (DB-scoped subset)
  - `db_cost_history_daily`
  - `fact_db_resource_daily`
  - optional scoped aggregates where present
  - DB recommendations scoped cleanup behavior
- Added reusable cleanup command/script for future reseed cycles.

2. Offline parquet reseed requirement:
- Used local parquet file as source:
  - `c:\Users\anmol\Downloads\KCX-CUR2-d3104779d1-00001.snappy.parquet`
- Kept same dev DB and same tenant/cloud/billing scope.
- Explicitly treated source as offline billing input (not live AWS validation).

3. Parquet pre-scan and profiling:
- Built/ran scan to inspect:
  - distinct service names
  - usage types
  - account IDs
  - regions
  - DB-family indicators
- Confirmed source account differed from connected account, as expected for offline reseed.

4. Ingestion blocker and fix:
- First ingest attempt failed because table `staging_cost_line_items` did not exist.
- Applied migrations (no DB reset/drop) to bring schema current.
- Re-ran local-file ingest successfully (`run_id=3`, rows loaded with no failed rows).

5. DB-family detection concern and expansion:
- User flagged RDS-only detection as too narrow for this parquet.
- Scan confirmed DB-family presence included:
  - `AmazonRDS`
  - `AmazonElastiCache` (Redis pattern)
- Runtime DB processor file was modified to broaden service detection.

6. Scope/safety review of runtime change:
- Determined runtime behavior had been globally altered in:
  - `backend/src/features/billing/services/db-cost-history.service.ts`
- Confirmed this is broader than a dev-only reseed need and can affect normal ingestion behavior.
- Recommended guardrail:
  - keep production/runtime behavior intentional and documented
  - move dev-only broad detection into offline reseed script/helper
  - avoid accidental service leakage into DB module tables.

## Key Artifacts Created/Changed During Chat
- Added:
  - `backend/scripts/cleanup-db-parquet-dev-scope.ts`
  - `backend/scripts/scan-db-parquet-offline.ts`
- Updated:
  - `backend/package.json` (cleanup command)
  - `backend/src/features/billing/services/db-cost-history.service.ts` (runtime DB-family expansion; later flagged for scope review)

## Final State at End of Chat
- Dev cleanup + offline ingest workflow executed.
- Schema migration issue resolved.
- Runtime DB-family expansion was explicitly flagged as requiring scope clarification and likely rollback/refactor into dev-only path before further ingestion.

