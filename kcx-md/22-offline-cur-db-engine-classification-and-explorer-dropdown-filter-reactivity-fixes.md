# 22 - Offline CUR DB Engine Classification and Explorer Filter/Dropdown Reactivity Fixes

## Chat Scope
This chat covered a full end-to-end fix chain for Database Explorer and DB asset classification after offline parquet/CUR ingestion:
1. Fixing offline DB engine classification for RDS MySQL assets showing `Unknown`.
2. Normalizing and data-driving Explorer DB service/engine/group-by options.
3. Fixing frontend Database dropdown rendering that still showed static taxonomy entries (notably MemoryDB).
4. Fixing filter non-reactivity where graph/table appeared unchanged after selection.

---

## 1) Offline CUR/Parquet DB Engine Classification Fix

### Problem
Database Asset Detail showed:
- Service: `AmazonRDS`
- Resource Type: `instance`
- Engine: `Unknown`
- Resource: `arn:aws:rds:us-east-1:647829529365:db:database-1`

Expected: RDS/MySQL classification from offline dataset, without live AWS inventory.

### Root Causes Found
1. `DB_ENGINE_SQL` relied too heavily on limited usage patterns and could miss explicit engine text signals.
2. `fact_db_resource_daily` rollup used `MAX(d.db_engine)`, so mixed category rows (`RDS MySQL` + `Unknown`) could collapse to `Unknown`.

### Backend File Updated
- `backend/src/features/billing/services/db-cost-history.service.ts`

### Fixes Implemented
- Expanded engine classification signals with precedence-safe rules:
  - Aurora first
  - Redis first
  - then engine-specific detection from `line_item_description`, `operation`, `usage_type`, `product_usage_type`
  - mappings added for `RDS MySQL`, `RDS MariaDB`, `RDS PostgreSQL`, `RDS Oracle`, `RDS SQL Server`
- Kept fallback from `instanceusage:db.*` to `RDS MySQL`.
- Changed fact rollup engine selection to prefer known values:
  - from `MAX(d.db_engine)`
  - to `COALESCE(MIN(NULLIF(d.db_engine, 'Unknown')), 'Unknown')`

### Scoped Reprocessing Done
- Re-ran DB sync for identified run:
  - `tenant_id`: `65020dec-5d2b-436a-b21a-182ad8703218`
  - `provider_id`: `1`
  - `billing_source_id`: `1`
  - `ingestion_run_id`: `3`

### Verification Outcome
For `arn:aws:rds:us-east-1:647829529365:db:database-1`:
- `db_cost_history_daily`: compute/storage rows classified as `RDS MySQL`.
- `fact_db_resource_daily`: `db_engine` became `RDS MySQL` (resource_type `instance`, service `AmazonRDS`).
- Existing `Aurora PostgreSQL` and `Redis` rows remained intact.

---

## 2) Explorer Option Generation and Label Normalization

### Problem
Explorer filters/group-by preview showed inconsistent raw vs normalized labels and stale entries:
- Mixed values like `AmazonRDS`, `AmazonElastiCache`, `Amazon Aurora`
- Missing ElastiCache in preview
- MemoryDB showing despite no persisted rows in scope

### Backend File Updated
- `backend/src/features/database/explorer/explorer.repository.ts`

### Fixes Implemented
- Introduced unified DB service display normalization expression used across:
  - DB service filter options
  - Group By `db_service`
  - grouped value preview `db_service`
  - dbService filter predicates
- Canonical labels:
  - `AmazonRDS` variants -> `Amazon RDS`
  - Aurora-engine rows -> `Amazon Aurora`
  - `AmazonElastiCache` variants -> `Amazon ElastiCache`
- Filter options now come from scoped persisted facts, not static lists.

### Compatibility Parsing Update
- `frontend/src/features/dashboard/pages/database/explorer.validators.ts` (backend request validator file path is backend version; frontend path noted later)
- Added normalization for incoming legacy db_service values (`AmazonRDS`, `AmazonElastiCache`, etc.) to canonical labels.

### Verified Result (Repository-Level)
- `dbServices`: `Amazon Aurora`, `Amazon ElastiCache`, `Amazon RDS`
- `dbEngines`: `Aurora PostgreSQL`, `RDS MySQL`, `Redis`
- `groupedValuePreview.db_type`: `Relational`, `In-Memory`
- MemoryDB not returned for this dataset.

---

## 3) Frontend Database Dropdown Still Showing MemoryDB

### Problem
Even after backend returned correct scoped services, UI Database dropdown still showed static taxonomy options including `Amazon MemoryDB`.

### Frontend Root Cause
`DatabaseExplorerFilters` rendered visible rows from static taxonomy/scope navigation structures rather than backend-provided options.

### Frontend File Updated
- `frontend/src/features/dashboard/pages/database/components/DatabaseExplorerFilters.tsx`

### Fixes Implemented
- Replaced static visible service rendering with backend-driven service entries:
  - uses `backendServiceOptions` from API response
  - still gated by `availableDatabaseScopes`
- Replaced static engine flyout source with backend-driven engine list:
  - uses `backendEngineOptions`
  - maps engines to currently visible service entries
- Result: MemoryDB no longer renders unless backend actually returns it.

---

## 4) Filters Appeared Non-Reactive (Graph/Table Not Changing)

### Problem
After selecting DB filters, graph/table looked unchanged.

### Root Cause Found
Filtered Explorer calls were failing in backend `getCards` due to SQL alias mismatch (`f.` referenced in unaliased query paths). Frontend was showing previous data due to React Query `placeholderData`, creating a stale-looking UI.

### Backend File Updated
- `backend/src/features/database/explorer/explorer.repository.ts`

### Fix Implemented
- Added unqualified DB service display SQL variant for no-alias queries.
- Updated filter builders to use:
  - aliased expression when alias exists
  - unqualified expression otherwise

### Validation
With filter `{ dbService: 'Amazon RDS', databaseScope: 'relational_rds' }`:
- `getCards` succeeds
- `getTrend` returns filtered rows
- `getTable` returns filtered rows

This unblocks visible graph/table changes on filter selection.

---

## Files Touched in This Chat
- `backend/src/features/billing/services/db-cost-history.service.ts`
- `backend/src/features/database/explorer/explorer.repository.ts`
- `frontend/src/features/dashboard/pages/database/components/DatabaseExplorerFilters.tsx`
- `frontend/src/features/dashboard/pages/database/explorer.validators.ts` (normalization intent documented in chat context)

---

## Net Outcome
- Offline CUR/parquet DB asset engine classification is corrected for RDS MySQL resources.
- Explorer DB service/engine/type option generation is normalized and scoped to persisted facts.
- Frontend Database dropdown is now backend data-driven, removing stale static MemoryDB visibility.
- Filter selections now correctly affect chart/table because backend filtered cards query path no longer errors.
