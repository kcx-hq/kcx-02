# Billing Uploads Module Summary

This document is an internal system-understanding reference for the current KCX Billing Uploads implementation.

Evidence labels used throughout:
- Confirmed from code: directly verified in current source.
- Likely / inferred: strong inference from code paths and current wiring.
- Not yet implemented / placeholder: route/screen/feature placeholder, or no executable code path found.

# 1. Module Overview

### What Billing Uploads represents
- Confirmed from code: Billing Uploads is the operational ingestion intake layer that creates ingestion jobs from billing files and tracks them through processing.
- Confirmed from code: It is exposed in client workspace via `/client/billing/uploads` and backed by `/billing/*` APIs.

### What business job it performs
- Confirmed from code: Accept billing file inputs (local file upload and temporary S3 import), persist metadata, queue ingestion, and transform raw rows into analytics/fact tables via orchestrator flow.
- Confirmed from code: Provide upload history and run status for user-facing operational tracking.

### Why the module is important
- Confirmed from code: Dashboard upload-scoped views rely on completed ingestion runs and selected `raw_billing_file_id` values (`backend/src/features/dashboard/shared/dashboard-scope-resolver.service.ts`).
- Confirmed from code: The feature is the bridge between "file arrived" and "queryable cost data".

### How it differs from cloud connections
- Confirmed from code: Cloud connections are persistent account/integration configuration records (`cloud_connections`, `cloud_integrations`, `billing_sources` with `setup_mode=cloud_connected`).
- Confirmed from code: Billing Uploads is event-driven ingestion execution (`raw_billing_files`, `billing_ingestion_runs`, `billing_ingestion_run_files`, row-error records).

### Why uploads are operational events vs persistent integrations
- Confirmed from code: A run is created per ingestion event (`createIngestionRun`) and tracked independently from integration lifecycle.
- Confirmed from code: Temporary S3 upload path creates temporary source/session context and still emits concrete ingestion events per selected object.

# 2. Upload Intake Paths

| Path | Current state | Starts in UI | User provides | Temporary vs persistent | Credentials stored? | How it reaches ingestion |
|---|---|---|---|---|---|---|
| Upload from Local CSV/Parquet | Implemented | `frontend/src/features/client-home/components/ManualBillingUploadDialog.tsx` (`Upload from Local`) | `cloudProviderId` + local file (`.csv,.parquet`) | Operational event, source is reused per tenant/provider/format | No cloud creds collected in this flow | `POST /billing/ingestion/upload` -> `storeManualFile` -> `createIngestionRun` -> `ingestionOrchestrator.processIngestionRun` |
| Upload from S3 (temporary session) | Implemented | Same dialog (`Upload from S3`) | `roleArn`, `bucket`, optional `prefix`, optional `externalId`, selected object keys | Temporary session + temporary billing source + per-file ingestion events | Not persisted to DB as connection; held in in-memory session store with TTL | `POST /billing/uploads/s3/session` -> list -> import -> creates raw files + runs per key -> orchestrator |
| Cloud-connected AWS export callback ingestion | Implemented (manifest callback path) | Not started from upload dialog; starts from cloud setup + AWS callback events | callback payload + manifest object in export bucket | Persistent integration path (`setup_mode=cloud_connected`) but still produces ingestion events | Uses configured connection role/externalId; no user-time credential prompt in this path | `/api/aws/export-file-arrived` -> queue manifest batch -> create raw files + run-file links -> trigger orchestrator |
| Cloud-connected initial backfill run creation | Partially implemented | Triggered after successful automatic connection validation | none from UI at that moment | Persistent integration context | n/a | `runInitialBackfillAfterValidation` queues raw/run records, but no direct run processing trigger found in this path |
| Manual cloud connection feature (`/api/aws/manual/*`) as Billing Uploads source | Not yet implemented / placeholder for this module | AWS manual setup flow in client billing connect-cloud | role/bucket/prefix/reportName | Persistent manual connection record | Yes, stored in `manual_cloud_connections` | No direct linkage found to `billing_sources`/`billing_ingestion_runs` ingestion path |

Notes:
- Confirmed from code: local upload accepts `.csv` and `.parquet` despite "Upload CSV" label.
- Confirmed from code: S3 temporary session is in-memory and ownership-bound by tenant+user.
- Confirmed from code: In `aws-export-file-event.controller.ts`, callback currently routes to manifest queue function regardless of `trigger_type` value.

# 3. End-to-End Flow

### A) Local upload flow (implemented)
- Confirmed from code:
1. User opens `ManualBillingUploadDialog` and submits local file + provider.
2. Frontend sends multipart form to `POST /billing/ingestion/upload`.
3. Backend validates auth tenant context, file presence, provider id, and file extension.
4. Backend gets or creates manual `billing_source` (`source_type=manual_upload`, `setup_mode=manual`, status default `draft`).
5. Backend uploads binary to raw S3 bucket (`RAW_BILLING_FILES_BUCKET`) and inserts `raw_billing_files` (`status=stored`).
6. Backend inserts `billing_ingestion_runs` (`status=queued`, `current_step=queued`, progress seeded).
7. Backend inserts `billing_ingestion_run_files` link (`file_role=data`).
8. Backend schedules async orchestrator (`setImmediate`).
9. Orchestrator progresses run across stages, writes facts/errors, and finalizes run as `completed`, `completed_with_warnings`, or `failed`.
10. Frontend polls status endpoint and updates history/status cards.

### B) Temporary S3 upload flow (implemented)
- Confirmed from code:
1. User enters role/bucket/prefix/externalId in upload dialog.
2. Backend assumes role and validates bucket/prefix access.
3. Backend creates in-memory S3 session (tenant/user bound, expiring).
4. User browses S3 scope and selects object keys.
5. Import call validates key scope/access and enforces single file format across selection.
6. Backend creates one temporary `billing_source` (`source_type=s3`, `setup_mode=temporary`, `is_temporary=true`).
7. For each selected object:
- stream-copy object into raw storage bucket,
- insert `raw_billing_files` (`status=stored`),
- create ingestion run + run-file link,
- enqueue orchestrator async.
8. Response returns arrays of `rawFileIds` and `ingestionRunIds`.
9. Frontend currently tracks first run ID for active polling.

### C) Cloud-connected manifest callback flow (implemented)
- Confirmed from code:
1. AWS sends callback to `/api/aws/export-file-arrived`.
2. Payload validated; manifest file downloaded and parsed.
3. Duplicate-manifest guard checks existing manifest raw file + manifest run link.
4. Transaction creates one manifest raw-file record + N parquet raw-file records (`status=queued`).
5. Transaction creates one ingestion run anchored to first parquet file.
6. Transaction creates run-file links (`manifest` + ordered `data` links).
7. Controller schedules orchestrator for created run.
8. Orchestrator detects manifest-linked run and delegates to AWS parquet processor.

### D) Cloud-connected initial backfill after validation (partial)
- Confirmed from code:
1. After AWS auto-connection validation, system calls `runInitialBackfillAfterValidation`.
2. It lists export files and queues raw file + ingestion run records for new files.
3. Likely / inferred: these queued runs need a separate trigger to process; no direct trigger in this code path was found.

# 4. Core Backend Components

### Entry routes and controllers
- `backend/src/features/billing/billing.routes.ts`
- `backend/src/features/billing/billing.controller.ts`
- `backend/src/features/billing/s3-upload/s3-upload.controller.ts`

Role:
- Confirmed from code: expose authenticated billing upload/status/history APIs.
- Confirmed from code: local upload uses multer memory upload (single file, 75 MB limit).

### Billing source and raw file persistence
- `backend/src/features/billing/services/billing-source.service.ts`
- `backend/src/features/billing/services/raw-file.service.ts`

Role:
- Confirmed from code: normalize manual source creation/reuse.
- Confirmed from code: upload to raw S3 storage and insert `raw_billing_files` records.

### Ingestion run lifecycle services
- `backend/src/features/billing/services/ingestion.service.ts`
- `backend/src/features/billing/services/ingestion-run-file.service.ts`
- `backend/src/features/billing/services/ingestion-row-error.service.ts`

Role:
- Confirmed from code: create/update runs, map run status for upload history, and maintain run-file linkage and row-level error persistence.

### Orchestration and processing
- `backend/src/features/billing/services/ingestion-orchestrator.service.ts`
- `backend/src/features/billing/services/aws-export-parquet.processor.ts`
- `backend/src/features/billing/services/file-reader.service.ts`
- `backend/src/features/billing/services/schema-validator.service.ts`
- `backend/src/features/billing/services/dimension-upsert.service.ts`
- `backend/src/features/billing/services/fact-cost-line-item.service.ts`

Role:
- Confirmed from code: drive stage transitions, parse CSV/parquet, validate canonical schema, map and insert fact rows, track progress, mark terminal status.
- Confirmed from code: manifest-linked runs use dedicated AWS parquet processor.

### Temporary S3 upload subsystem
- `backend/src/features/billing/s3-upload/s3-upload.schema.ts`
- `backend/src/features/billing/s3-upload/s3-upload.service.ts`
- `backend/src/features/billing/s3-upload/s3-upload-aws.service.ts`
- `backend/src/features/billing/s3-upload/s3-upload-session.store.ts`

Role:
- Confirmed from code: validate temporary upload request payloads, perform role assumption and S3 browsing, and maintain short-lived in-memory scoped sessions.

### Cloud-connected ingestion feeders
- `backend/src/features/cloud-connections/aws/auto-connection/cloud-connections.controller.ts`
- `backend/src/features/cloud-connections/aws/exports/aws-export-file-event.controller.ts`
- `backend/src/features/cloud-connections/aws/exports/aws-export-ingestion.service.ts`

Role:
- Confirmed from code: create/update connected billing source metadata, queue callback-driven runs, and trigger orchestrator.

# 5. Database Entities and Persistence Model

### Entity map

| Table / Model | Purpose | Data category | Key fields (current behavior) | Key relationships |
|---|---|---|---|---|
| `billing_sources` (`backend/src/models/billing-source.ts`) | Source/integration descriptor for ingest origin | Source metadata | `tenant_id`, `cloud_connection_id`, `cloud_provider_id`, `source_type`, `setup_mode`, `format`, `schema_type`, `is_temporary`, `bucket_name`, `path_prefix`, `cadence`, `status`, `last_*` timestamps | 1:N to `raw_billing_files`; 1:N to `billing_ingestion_runs`; optional link to cloud connection |
| `raw_billing_files` (`backend/src/models/raw-billing-file.ts`) | Canonical raw file record used for processing | File metadata | `billing_source_id`, `tenant_id`, `cloud_provider_id`, `source_type`, `setup_mode`, `uploaded_by`, `original_file_name`, `original_file_path`, `raw_storage_bucket`, `raw_storage_key`, `file_format`, `file_size_bytes`, `checksum`, `status` | N:1 source; 1:N ingestion runs; optional uploader relation |
| `billing_ingestion_runs` (`backend/src/models/billing-ingestion-run.ts`) | Ingestion execution state and progress | Run metadata | `billing_source_id`, `raw_billing_file_id`, `status`, `current_step`, `progress_percent`, `status_message`, counters, heartbeat, error, start/finish timestamps | N:1 source; N:1 raw file; 1:N run files; 1:N row errors |
| `billing_ingestion_run_files` (`backend/src/models/billing-ingestion-run-file.ts`) | Link table for multi-file run composition | Run-file linkage metadata | `ingestion_run_id`, `raw_billing_file_id`, `file_role` (`manifest`/`data`), `processing_order` | Enables manifest + data grouping per run |
| `billing_ingestion_row_errors` (`backend/src/models/billing/billing_ingestion_row_error.ts`) | Per-row error audit for failed transforms/inserts | Error metadata | `ingestion_run_id`, `raw_billing_file_id`, `row_number`, `error_code`, `error_message`, `raw_row_json` | Linked to run and optionally raw file |
| `manual_cloud_connections` (`backend/src/models/manual-cloud-connection.ts`) | Manual AWS connection registry | Integration metadata (separate module) | role/account/bucket/prefix/report + validation/status fields | No direct ingestion linkage found to billing upload run creation |

### About `billing_uploads` entity
- Confirmed from code: there is no `billing_uploads` table/model currently.
- Confirmed from code: "billing upload history" is derived from `billing_ingestion_runs` joined to `raw_billing_files` (and source/user context).

# 6. Upload Types and Their Meaning

### Local CSV/Parquet manual upload
- Confirmed from code: one user action uploads one local file to raw storage and creates one ingestion run.
- Architecture: manual, non-persistent credentials, operational event, one-time run per file.

### Temporary S3 upload
- Confirmed from code: session-scoped role-based browsing/import; one temporary source per import action; one run per selected object.
- Architecture: temporary access, manual action, event-driven run creation, not a persistent cloud integration.

### Cloud-connected ingestion (AWS Data Exports)
- Confirmed from code: persistent integration creates/maintains billing source metadata and receives callback-driven file events.
- Architecture: persistent setup (`setup_mode=cloud_connected`) but ingestion still materializes as operational runs.

### Manual cloud connection feature
- Not yet implemented / placeholder (for this module): manual cloud connection records exist, but no direct run creation path from this feature into billing upload run history was found.

# 7. Status Model

### A) Ingestion run statuses (`billing_ingestion_runs.status`)

| Status | Meaning | Set in |
|---|---|---|
| `queued` | Run created, waiting to start | `createIngestionRun`, AWS queue helpers |
| `validating_schema` | Validating headers/schema | `ingestion-orchestrator.service.ts`, `aws-export-parquet.processor.ts` |
| `reading_rows` | Reading source rows | orchestrators |
| `normalizing` | Canonical normalization + mapping | orchestrators |
| `upserting_dimensions` | Resolving/upserting dimensions | main orchestrator |
| `inserting_facts` | Persisting fact rows | orchestrators |
| `finalizing` | Final counters/terminal transition | orchestrators |
| `completed` | Success without row failures | orchestrators |
| `completed_with_warnings` | Completed with row failures/warnings | orchestrators |
| `failed` | Terminal failure | orchestrators |

### B) Upload history status returned to UI (`/billing/uploads/history`)

| History status | Derived from run status | Meaning to user |
|---|---|---|
| `queued` | run `queued` | waiting |
| `processing` | any active non-terminal status | in progress |
| `completed` | run `completed` and no failed rows | success |
| `warning` | run `completed_with_warnings` OR completed with failed rows | partial success |
| `failed` | run `failed` | failed |

### C) Raw file statuses (`raw_billing_files.status`)

| Status | Observed use |
|---|---|
| `stored` | local + temporary S3 upload records after object persisted to raw bucket |
| `queued` | AWS callback/backfill queued files before processing |

### D) Billing source statuses (`billing_sources.status`)

| Status | Context |
|---|---|
| `draft` | manual local source default |
| `awaiting_validation` | cloud setup accepted, validation pending |
| `waiting_for_first_file` / `pending_first_file` / `syncing` | cloud-connected progression during validation/backfill lifecycle |
| `active` | source considered active (also set after some ingestions) |
| `suspended` | delete/disconnect callback path |
| `failed` | validation/backfill failures |

Notes:
- Confirmed from code: status vocab differs by table (source vs raw file vs run vs cloud integration). They are not a single shared enum.
- Likely / inferred: admin-facing UX should present normalized status families while preserving raw status detail for operations.

# 8. Current UI / User-Facing Surfaces

### Client app surfaces
- `frontend/src/features/client-home/pages/ClientOverviewPage.tsx`
- `frontend/src/features/client-home/pages/ClientBillingPage.tsx`
- `frontend/src/features/client-home/components/ManualBillingUploadDialog.tsx`
- `frontend/src/features/client-home/components/BillingUploadHistorySection.tsx`
- `frontend/src/features/client-home/components/IngestionStatusCard.tsx`

What exists now:
- Confirmed from code: Billing workspace route defaults toward uploads (`frontend/src/lib/navigation.ts` redirects `/client/billing` -> `/client/billing/uploads`).
- Confirmed from code: Upload dialog supports "Upload from Local" and "Upload from S3".
- Confirmed from code: History table uses backend `/billing/uploads/history` and supports status filter/search/select.
- Confirmed from code: User can open run details (`/billing/ingestions/:id/status`) and open dashboard scope from selected file IDs.
- Confirmed from code: Active run polling persists run id in localStorage and resumes on reload.

Current gaps in user-facing behavior:
- Confirmed from code: Retry button in history just reopens upload dialog; no true backend retry operation.
- Confirmed from code: For S3 multi-file import, frontend tracks only first run ID for active status polling.
- Confirmed from code: Dialog text says temporary S3 access "up to 48 hours", but backend session TTL is clamped to 30-60 minutes.

### Admin app surface (future module placeholder)
- `admin/src/App.tsx` has route `/billing-uploads`.
- `admin/src/features/sections/pages/SectionPage.tsx` currently renders generic placeholder content.
- Confirmed from code: no admin billing uploads API client/module implemented yet.

# 9. What the Module Currently Shows vs What It Actually Represents

### User-facing concept
- Confirmed from code: users see "uploads" as rows in history with status and row counts.

### Operational reality
- Confirmed from code: a displayed history row maps to an ingestion run (`billing_ingestion_runs.id`) joined to one anchor raw file.
- Confirmed from code: in manifest-based ingestion, one run can involve multiple raw files via `billing_ingestion_run_files` (manifest + data files), but history remains run-centric.
- Confirmed from code: upload experience is event-centric; integration setup and run execution are separate layers.

Practical interpretation:
- Likely / inferred: a "billing upload" row is best treated as an ingestion job event, not strictly a single uploaded binary.

# 10. Relationship to Admin Panel

### What admin Billing Uploads should observe from current system
- Confirmed from code: primary operational truth is in run/file/source tables, not a dedicated `billing_uploads` entity.

Recommended admin-observable fields (grounded in current persistence):

| Category | Useful fields now available | Source |
|---|---|---|
| Tenant/client context | `tenant_id`, uploader (`uploaded_by` -> user), source linkage | `raw_billing_files`, `billing_sources`, `users` |
| Upload identity | file name/path, format, storage location, size, checksum | `raw_billing_files` |
| Run execution | run id, status, current step, progress, counters, heartbeat, started/finished, error message | `billing_ingestion_runs` |
| Multi-file context | manifest/data roles and processing order | `billing_ingestion_run_files` |
| Failure diagnostics | row-level error code/message/raw row | `billing_ingestion_row_errors` |
| Integration linkage | source type/setup mode/cloud connection id/is temporary | `billing_sources` |

Admin monitoring capabilities that align with current architecture:
- Likely / inferred: queue health (stuck in queued/processing), failure concentration by error code, per-tenant ingestion throughput, temporary upload traceability, and cloud-connected callback run visibility.

# 11. Current Limitations / Gaps / Ambiguities

1. Confirmed from code: no canonical `billing_uploads` table; history is inferred from runs.
2. Confirmed from code: temporary S3 session state is in-memory only (`s3-upload-session.store.ts`), so restart invalidates sessions.
3. Confirmed from code: UI claims S3 temporary access up to 48h, backend enforces 30-60 min.
4. Confirmed from code: callback controller currently calls manifest queue path regardless of `trigger_type`; `queueExportFileFromEvent` exists but is not used in controller flow.
5. Confirmed from code: `runInitialBackfillAfterValidation` queues runs but no immediate processing trigger in that path was found.
6. Confirmed from code: history retry action has no dedicated retry backend operation.
7. Confirmed from code: S3 multi-file import queues multiple runs, but current active polling in UI uses first run id only.
8. Confirmed from code: comments in `ingestion.service.ts` say uploader identity not persisted, but `raw_billing_files.uploaded_by` and optional user join exist; this is documentation/comment drift.
9. Likely / inferred: status taxonomy across source/raw-file/run/cloud-integration can create operator confusion unless normalized in admin view.
10. Not yet implemented / placeholder: admin billing uploads module UI/API integration (route exists, feature page not implemented).
11. Not yet implemented / placeholder: manual cloud connection module is not wired into billing source/run ingestion path.

Overall implementation maturity:
- Likely / inferred: mixed maturity (core local + temp S3 + run tracking are functional; cloud-connected event paths are partially complete and operational semantics still evolving).

# 12. Suggested Canonical Mental Model

A Billing Upload in KCX is best defined as:

"A tenant-scoped ingestion execution event that binds one or more raw billing file records to an ingestion run lifecycle, resulting in processed cost facts and observable operational status."

Implications:
- Confirmed from code: upload rows are run events, not merely file objects.
- Confirmed from code: source/integration records describe where data comes from, while run records describe what happened operationally.
- Likely / inferred: admin module should center on ingestion-run observability with drill-down into source and raw-file context.