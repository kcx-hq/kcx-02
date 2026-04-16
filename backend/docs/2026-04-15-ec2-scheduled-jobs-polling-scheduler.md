# EC2 scheduled jobs polling scheduler (V1)

## What it does

The backend runs a lightweight DB-polling scheduler that executes recurring EC2 jobs stored in the `scheduled_jobs` table.

Core behaviors:
- Polls every 60s (configurable).
- Claims due rows using `FOR UPDATE SKIP LOCKED` so multiple backend instances can run safely.
- Marks rows `running` before executing handlers.
- Runs handlers outside the claiming transaction to avoid holding row locks while work is in progress.
- Marks rows `completed` / `failed` and always advances `next_run_at` so failures do not hot-loop.

## Claiming/locking flow

1. Transaction:
   - Select due jobs (`is_enabled = true` and `next_run_at <= now()`) with `FOR UPDATE SKIP LOCKED`.
   - Update the selected rows to `last_status = 'running'`, set `last_run_at = now()`, `updated_at = now()`.
2. Commit.
3. Execute the job handler.
4. Update success/failure status + compute and store `next_run_at`.

This pattern allows safe parallelism across multiple workers while keeping DB locks short-lived.

## Job dispatch

Jobs are dispatched by `job_type`:
- `ec2_inventory_sync`
- `ec2_metrics_sync` (uses `lookback_hours`, default 24)
- `ec2_daily_rollup`

Handlers are currently stubs and should be expanded to write into:
- `ec2_instance_inventory_snapshots`
- `ec2_instance_utilization_hourly`
- `ec2_instance_utilization_daily`

## Configuration

Environment variables (see `backend/.env.example`):
- `EC2_SCHEDULED_JOBS_SCHEDULER_ENABLED` (default `true`)
- `EC2_SCHEDULED_JOBS_POLL_INTERVAL_MS` (default `60000`)
- `EC2_SCHEDULED_JOBS_BATCH_SIZE` (default `10`)
- `EC2_SCHEDULED_JOBS_MAX_BATCHES_PER_POLL` (default `5`)

## Code pointers

- Scheduler loop: `backend/src/features/ec2/scheduled-jobs/scheduled-jobs.scheduler.service.ts`
- Claim/update SQL: `backend/src/features/ec2/scheduled-jobs/scheduled-jobs.repository.ts`
- Dispatcher: `backend/src/features/ec2/scheduled-jobs/scheduled-jobs.dispatcher.ts`
- Handlers: `backend/src/features/ec2/scheduled-jobs/handlers/`

