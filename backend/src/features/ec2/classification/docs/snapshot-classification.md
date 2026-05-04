# Snapshot Classification

## Purpose
Classifies snapshot lifecycle health signals.

## Inputs
- `ageDays`
- `likelyOrphaned`

## Output
- `primaryCondition`: `old | orphaned | normal`
- `signals`: `[]`, `["old"]`, `["orphaned"]`, or `["old","orphaned"]`

## Rules
- `OLD_SNAPSHOT_AGE_DAYS = 90`
- `old` when `ageDays != null && ageDays >= 90`
- `orphaned` when `likelyOrphaned=true`
  - `likelyOrphaned` should be set to true when source volume is:
    - missing (`sourceVolumeId` is null),
    - deleted/deleting,
    - unavailable/error/failed,
    - or cannot be matched to an active current volume in inventory.
- Both can be returned in signals when both conditions match.

## Priority / Order
Primary condition priority:
1. old
2. orphaned
3. normal

## Edge Cases
- Null age cannot trigger `old`.
- If both old and orphaned are true, primary is `old` and signals include both.
- Classifier does not compute recommendation text/actions; it only returns condition/signal outputs.

## Example Inputs & Outputs
- Input: `ageDays=120, likelyOrphaned=true`
  Output: `primaryCondition=old`, `signals=["old","orphaned"]`
- Input: `ageDays=20, likelyOrphaned=true`
  Output: `primaryCondition=orphaned`, `signals=["orphaned"]`
- Input: `ageDays=20, likelyOrphaned=false`
  Output: `primaryCondition=normal`, `signals=[]`
- Input: `ageDays=null, likelyOrphaned=false`
  Output: `primaryCondition=normal`, `signals=[]`

## Practical Orphaned Examples
- Snapshot has `sourceVolumeId = null` -> orphaned.
- Snapshot has `sourceVolumeId = vol-123`, but no active inventory row matches connection/region -> orphaned.
- Snapshot has matched volume, but matched volume state is `deleted` or `unavailable` -> orphaned.
