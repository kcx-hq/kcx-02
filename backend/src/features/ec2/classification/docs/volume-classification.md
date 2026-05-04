# Volume Classification

## Purpose
Classifies EBS volume state/utilization signals.

## Inputs
- `isAttached`
- `attachedInstanceState`
- `isIdleCandidate`
- `isUnderutilizedCandidate`
- `volumeReadOps`
- `volumeWriteOps`
- `volumeReadBytes`
- `volumeWriteBytes`
- `volumeCost`

## Output
- `primaryCondition`: `unattached | attached_stopped | idle | underutilized | normal`
- `signals`: list of valid signals from `unattached | attached_stopped | idle | underutilized | low_utilization`

## Rules
- `unattached` when `isAttached !== true`
- `attached_stopped` when attached and attached instance state is `stopped`
- `idle` when attached and `isIdleCandidate=true`
- `underutilized` when attached and `isUnderutilizedCandidate=true`
- `low_utilization` when all are true:
  - attached
  - attached instance state is `running`
  - `volumeReadOps <= 100` and `volumeWriteOps <= 100`
  - `volumeReadBytes <= 1 GiB` and `volumeWriteBytes <= 1 GiB`
  - `volumeCost > 5`
- Multiple signals can co-exist.

## Priority / Order
Primary condition priority:
1. unattached
2. attached_stopped
3. idle
4. underutilized
5. normal

Note: `low_utilization` is currently signal-only and does not affect primary condition priority.

## Edge Cases
- Null `isAttached` is treated as not attached.
- State text is normalized (`trim().toLowerCase()`).
- Conflicts are resolved by priority for `primaryCondition`; all valid signals are still returned.

## Example Inputs & Outputs
- Input: `isAttached=false`
  Output: `primaryCondition=unattached`, `signals=["unattached"]`
- Input: `isAttached=true, attachedInstanceState=stopped, isIdleCandidate=true`
  Output: `primaryCondition=attached_stopped`, `signals=["attached_stopped","idle"]`
- Input: `isAttached=true, attachedInstanceState=running, isUnderutilizedCandidate=true`
  Output: `primaryCondition=underutilized`, `signals=["underutilized"]`
