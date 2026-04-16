# EC2 daily rollup (scheduled job) manual test

## What it does

`ec2_daily_rollup` aggregates `ec2_instance_utilization_hourly` into `ec2_instance_utilization_daily` for a bounded UTC date range.

- Default: rolls up **yesterday (UTC)** only.
- Optional: set `config_json.rebuild_recent_days` on the scheduled job to rebuild the last N completed days (caps at 30).

## Prereqs

- Hourly data exists in `ec2_instance_utilization_hourly` for the target connection.
- Migrations applied (daily table + scheduled_jobs table).

## Create/enable a scheduled job

```sql
INSERT INTO scheduled_jobs (
  job_type,
  tenant_id,
  cloud_connection_id,
  provider_id,
  schedule_type,
  interval_minutes,
  is_enabled,
  config_json,
  next_run_at,
  created_at,
  updated_at
)
VALUES (
  'ec2_daily_rollup',
  '<tenant_uuid>',
  '<cloud_connection_uuid>',
  <provider_id_bigint>,
  'interval',
  1440,
  true,
  '{"rebuild_recent_days": 3}',
  NOW(),
  NOW(),
  NOW()
);
```

Force due if needed:

```sql
UPDATE scheduled_jobs
SET is_enabled = true, next_run_at = NOW(), updated_at = NOW()
WHERE cloud_connection_id = '<cloud_connection_uuid>' AND job_type = 'ec2_daily_rollup';
```

## Run the backend and watch logs

```bash
npm --prefix backend run dev
```

Expected logs include:
- rollup date range (`startDate` / `endDate`)
- `hourlySourceRows` counted
- `dailyRowsUpserted` written/updated

## Verify rows were written

```sql
SELECT instance_id, usage_date, cpu_avg, network_in_bytes, ebs_read_bytes, metric_source, updated_at
FROM ec2_instance_utilization_daily
ORDER BY updated_at DESC
LIMIT 50;
```

