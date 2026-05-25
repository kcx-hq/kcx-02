# 15 - DB Explorer Cost Basis Maturity Gate and Redis Storage Classification Fix

## Chat Scope
This chat covered two implementation tracks in `kcx-v2`:
1. UI maturity gating for Database Explorer Cost Basis selection.
2. Backend DB billing classifier fix for Redis Serverless storage usage.

---

## 1) Database Explorer Cost Basis Maturity Gating (Frontend)

### Goal
Keep future Cost Basis options visible in Database Explorer, but only allow trusted/populated options to be selectable.

### Required Behavior
- `Billed Cost`: enabled, selectable, default
- `Effective Cost`: visible but disabled
- `Amortized Cost`: visible but disabled
- `Net Amortized Cost`: visible but disabled
- `net_unblended_cost`: remain removed/not shown

### Constraints Followed
- UI-only product maturity gate
- No backend contract removal
- No changes to Group By, Database Scope, Resource Type/Cost Category logic, graph, KPI, usage mode, assets, recommendations, Redis/other taxonomy

### Files Updated
- `frontend/src/features/dashboard/pages/database/components/DatabaseExplorerFilters.tsx`
- `frontend/src/features/dashboard/pages/database/DatabaseExplorerPage.tsx`

### Exact Strategy Implemented
- Added `enabled` flag to Cost Basis options in Database Explorer filter UI.
- Used native `disabled` on unsupported options in the Cost Basis popover.
- Kept option order/layout unchanged.
- Reused existing disabled styling (`.cost-explorer-filter-option:disabled`) for intentional unavailable visual state.
- Added page-level guard to force unsupported basis values back to default `billed_cost`.

### Validation
- Frontend build passed (`npm run build` in `frontend`).
- `billed_cost` remains default and active.
- Unsupported basis options are visible but non-selectable.

---

## 2) Redis Serverless Storage Classification Fix (Backend)

### Problem
ElastiCache Redis Serverless storage usage (example: `USE1-CachedData:Redis`, `CreateServerlessCache`, `"$0.125 per GB-hour for Redis data storage"`) was classifying into `other`.

### Goal
Classify these Redis/ElastiCache storage rows as `storage`.

### Targeted File
- `backend/src/features/billing/services/db-cost-history.service.ts`

### Classification Additions (Case-Insensitive)
Added storage signals scoped to cache context:
- `cacheddata`
- `bytesusedforcache`
- `storageusage`
- `gb-hour` (description)
- `redis data storage` (description)
- `createserverlesscache` (operation)

### Matching Fields Used
- `usage_type`
- `product_usage_type`
- `line_item_description`
- `operation`

### Safety/Scope Controls
- Scoped to `AmazonElastiCache` / `AmazonMemoryDB` and cache-related usage signals.
- Added exclusions to avoid misclassifying compute/request/io cache rows in this storage branch:
  - `nodeusage`
  - `ecpuusage`
  - `request`
  - `io`

### Rebuild/Reprocess Performed
- Backend build passed (`npm run build` in `backend`).
- Reprocessed candidate ingestion run(s) containing Redis cached data signals by invoking:
  - `syncDbCostHistoryForIngestionRun(...)` via a one-off Node script.
- Observed run processed:
  - `ingestionRunId=17`
  - affected date range included `2026-05-01` to `2026-05-19`.

### Verification Query Used
```sql
SELECT
  db_service,
  db_engine,
  cost_category,
  SUM(billed_cost) AS billed_cost
FROM db_cost_history_daily
WHERE db_service = 'AmazonElastiCache'
GROUP BY db_service, db_engine, cost_category;
```

### Verification Outcome Summary
- `storage` appeared with positive billed cost for `AmazonElastiCache` + `Redis`.
- `other` did not appear in the reported post-rebuild ElastiCache result set.
- Credits/tax remained as separate expected categories.

---

## Net Outcome of This Chat
- Database Explorer now enforces current cost basis maturity through UI gating only.
- Redis Serverless storage billing classification is corrected from `other` to `storage` in DB cost history processing, with rebuild and verification executed.
