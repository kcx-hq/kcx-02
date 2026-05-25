# 06 - Usage CTA Phase 2 (Cluster)

## Goal
Enable Usage Mode cluster drilldown from Explorer to Assets.

## Frontend Changes
- `DatabaseExplorerPage.tsx`
  - Added `cluster` to usage-supported CTA dimensions.
  - Added synthetic-value guard (`unknown`, `standalone-no-cluster` no-op).
- `db-assets-page.tsx`
  - URL hydration for `cluster`/`clusterId`.
- `db-assets-filters.tsx`
  - State support for `cluster` (no redesign).
- `dashboardTypes.ts` and `dashboardApi.ts`
  - Added `cluster` to assets filter contract and request builder.

## Backend Changes
- `assets.types.ts`: query param type support for `cluster`.
- `assets.validators.ts`: parse/validate `cluster` (`clusterId` alias supported).
- `assets.repository.ts`: normalized cluster matching in assets filtering.

## Matching Inputs Used
- `cluster_id`
- resource ARN / resource name
- metadata cluster identifiers
