# 05 - Usage CTA Phase 1

## Goal
Enable Usage Mode CTA (graph/table) for supported dimensions.

## Supported in Phase 1
- `db_service`
- `db_engine`
- `region`
- `instance_class`

## Deferred in Phase 1
- `cluster`
- usage metric/capability as backend filters (kept as URL context)

## Main Implementation
- Added dedicated Usage CTA mapper in:
  - `frontend/src/features/dashboard/pages/database/DatabaseExplorerPage.tsx`
- Shared navigation path for graph and table.
- URL includes:
  - `source=database_explorer`
  - `metric=usage`
  - `group_by`, `group_key`, `group_label`
  - `start_date`, `end_date`, `database_scope` (if active)
  - `capability_family`, `usage_metric`
