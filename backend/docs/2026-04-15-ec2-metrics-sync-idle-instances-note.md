# EC2 metrics sync: idle instances, missing datapoints, and debugging

## Why idle instances still need hourly rows

Even when an EC2 instance is running but idle (near-zero CPU/network/disk), it is still a real utilization observation for that hour.
For capacity and cost workflows, it is often more useful to persist a row with null/zero metrics than to drop the instance-hour entirely.

## Missing datapoints vs. zero values

- `0` is treated as a valid metric value and is persisted.
- `null` means the metric was missing (no datapoint returned by CloudWatch for that metric/hour).
- Missing metrics for one series do **not** cause the entire instance-hour row to be dropped.

## Row-building behavior

For each scheduled run, the handler:
- Computes a bounded lookback window where `end` is the current time floored to the hour (UTC), and only completed hours are included.
- Initializes an instance-hour grid for every discovered instance and every hour in the window.
- Fills metrics opportunistically from CloudWatch `GetMetricData` results (partial results are expected).
- Upserts all rows for the window keyed by `(instance_id, hour_start)`.

## New debug logs

The handler now emits `debug` logs per region batch showing:
- `windowHours`
- `rowsToUpsert`
- `instanceHoursWithAnyMetric` vs `instanceHoursEmpty`
- a small `sampleRow` payload

Region completion logs also include:
- `metricDataResultsReturned`
- `metricDataResultsWithValues`

