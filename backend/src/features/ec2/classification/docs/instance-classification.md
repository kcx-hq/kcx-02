# Instance Classification

## Purpose
Classifies EC2 instance utilization and coverage signals used by inventory/optimization.

## Inputs
- Candidate flags: `isIdleCandidate`, `isUnderutilizedCandidate`, `isOverutilizedCandidate`, `uncoveredHours`
- Metric fallback fields: `avgCpu`, `avgDailyNetworkMb`, `runningHours|totalHours`, `computeCost|totalCost`
- Coverage/pricing fields: `pricingType|reservationType|pricingModel`, `coveredHours`, `runningDays`

## Output
- `primaryCondition`: `idle | underutilized | overutilized | healthy`
- `signals`: zero/many of `idle | underutilized | overutilized | uncovered_on_demand`
- `pricingCondition`: `uncovered_on_demand | covered | unknown`
- Legacy helper `classifyInstanceCondition`: `idle | underutilized | overutilized | uncovered | healthy`

## Rules
- Utilization metric fallback is gated by:
  - `runningHours >= 24`
  - `totalCost (or computeCost) > 5`
- Fallback thresholds:
  - idle: `avgCpu < 5` and `avgDailyNetworkMb < 100`
  - underutilized: `avgCpu >= 5 && avgCpu < 20` and `avgDailyNetworkMb < 1024`
  - overutilized: `avgCpu > 75`
- If explicit candidate flags are present, they are used; otherwise metric fallback is used.
- `uncovered_on_demand` fallback (when `uncoveredHours` is null):
  - pricing normalized to `on_demand`
  - running hours >= 24
  - running days > 1
  - computeCost > 5
  - uncovered coverage exists (`runningHours - coveredHours > 0`)
- `pricingCondition = unknown` when pricing fields are missing.

## Priority / Order
- Primary utilization condition order:
  1. idle
  2. underutilized
  3. overutilized
  4. healthy
- Pricing signal is independent and appended as additional signal.

## Edge Cases
- Missing pricing fields => `pricingCondition=unknown`.
- Missing metrics and null flags => `primaryCondition=healthy`.
- `uncovered_on_demand` never becomes primary utilization condition.

## Example Inputs & Outputs
- Input: `avgCpu=2, avgDailyNetworkMb=50, runningHours=48, totalCost=30, pricingType=on_demand, coveredHours=0, computeCost=20`
  Output: `primaryCondition=idle`, `signals=["idle","uncovered_on_demand"]`, `pricingCondition=uncovered_on_demand`
- Input: `isUnderutilizedCandidate=true, uncoveredHours=0, pricingType=reserved`
  Output: `primaryCondition=underutilized`, `signals=["underutilized"]`, `pricingCondition=covered`
- Input: `avgCpu=3, avgDailyNetworkMb=40, runningHours=12, totalCost=2, pricingType=on_demand`
  Output: `primaryCondition=healthy`, `signals=[]`, `pricingCondition=covered`
