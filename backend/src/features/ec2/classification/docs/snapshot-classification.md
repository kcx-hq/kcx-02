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
- Both can be returned in signals when both conditions match.

## Priority / Order
Primary condition priority:
1. old
2. orphaned
3. normal

## Edge Cases
- Null age cannot trigger `old`.
- If both old and orphaned are true, primary is `old` and signals include both.

## Example Inputs & Outputs
- Input: `ageDays=120, likelyOrphaned=true`
  Output: `primaryCondition=old`, `signals=["old","orphaned"]`
- Input: `ageDays=20, likelyOrphaned=true`
  Output: `primaryCondition=orphaned`, `signals=["orphaned"]`
- Input: `ageDays=null, likelyOrphaned=false`
  Output: `primaryCondition=normal`, `signals=[]`
