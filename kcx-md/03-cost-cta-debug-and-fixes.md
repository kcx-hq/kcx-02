# 03 - Cost CTA Debug and Fixes

## Main Problems Encountered
- Cost graph clicks not navigating initially.
- Then navigating but producing empty Assets results.
- Graph/table payload mismatch for service/engine values.
- Region identifier mismatch risk.

## Key Frontend Files Involved
- `frontend/src/features/dashboard/pages/database/DatabaseExplorerPage.tsx`
- `frontend/src/features/dashboard/pages/database/components/DatabaseExplorerTrend.tsx`
- `frontend/src/features/dashboard/common/charts/BaseEChart.tsx`

## Key Fix Themes
- Unified chart click resolution (`seriesId` -> `seriesIndex` -> name matching).
- Removed fabricated fallback keys from labels.
- Enforced no-op when graph series cannot be reliably resolved.
- Aligned DB Service/DB Engine concrete filter mapping to label-first where needed.
- Preserved `group_key`/`group_label` context params.

## Additional UX Adjustment
- Removed `Unknown` / `Unknown engine` series from Cost + DB Engine chart/table presentation layer.
