# EC2 metrics sync (scheduled job) manual test

## Prereqs

- `DB_URL` points to a Postgres DB with migrations applied (including `scheduled_jobs` and `ec2_instance_utilization_hourly`).
- An AWS cloud connection exists in `cloud_connections` with:
  - `action_role_arn` (preferred) or `billing_role_arn`
  - `external_id`
  - `region` (used for initial region discovery)
- The assumed role has CloudWatch read permissions (`GetMetricData`, etc).

## Create/enable a scheduled job

Insert an interval job (adjust IDs/interval as needed):

```sql
INSERT INTO scheduled_jobs (
  job_type,
  tenant_id,
  cloud_connection_id,
  provider_id,
  schedule_type,
  interval_minutes,
  is_enabled,
  lookback_hours,
  next_run_at,
  created_at,
  updated_at
)
VALUES (
  'ec2_metrics_sync',
  '<tenant_uuid>',
  '<cloud_connection_uuid>',
  <provider_id_bigint>,
  'interval',
  60,
  true,
  24,
  NOW(),
  NOW(),
  NOW()
);
```

If you already have an existing row, you can force it due:

```sql
UPDATE scheduled_jobs
SET is_enabled = true, next_run_at = NOW(), updated_at = NOW()
WHERE cloud_connection_id = '<cloud_connection_uuid>' AND job_type = 'ec2_metrics_sync';
```

## Run the backend and watch logs

Start the backend:

```bash
npm --prefix backend run dev
```

Expected log flow:
- `EC2 scheduled jobs scheduler started`
- `Scheduled job started` (for `ec2_metrics_sync`)
- `EC2 metrics sync started` + region/instance counts
- Per-region completion logs including `cloudWatchBatches` and `hourlyRowsUpserted`

## Verify rows were written

```sql
SELECT instance_id, hour_start, cpu_avg, network_in_bytes, ebs_read_bytes, metric_source, updated_at
FROM ec2_instance_utilization_hourly
ORDER BY updated_at DESC
LIMIT 50;
```

