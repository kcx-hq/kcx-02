# Volume Classification

## Purpose
Classifies EBS volume state/utilization signals.

## Inputs
- `isAttached`
- `attachedInstanceState`
- `isIdleCandidate`
- `isUnderutilizedCandidate`

## Output
- `primaryCondition`: `unattached | attached_stopped | idle | underutilized | normal`
- `signals`: list of valid signals from `unattached | attached_stopped | idle | underutilized`

## Rules
- `unattached` when `isAttached !== true`
- `attached_stopped` when attached and attached instance state is `stopped`
- `idle` when attached and `isIdleCandidate=true`
- `underutilized` when attached and `isUnderutilizedCandidate=true`
- Multiple signals can co-exist.

## Priority / Order
Primary condition priority:
1. unattached
2. attached_stopped
3. idle
4. underutilized
5. normal

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
