# Cloud Connections System Understanding

## 1. Executive Summary

- KCX currently has two implemented AWS connection paradigms: `automatic` (CloudFormation + callback) and `manual` (role/bucket validation + record creation).
- The canonical tenant-facing listing entity is `cloud_integrations` (not `cloud_connections` directly), populated/synced by service logic.
- `cloud_connections` stores automatic AWS connection config/lifecycle metadata (callback token, role ARN, export fields, status).
- `manual_cloud_connections` stores manual AWS configuration and last validation outcome.
- `billing_sources` is the ingestion bridge entity; automatic callbacks upsert cloud-connected billing sources, and temporary S3 import creates temporary billing sources.
- Temporary S3 upload (`/billing/uploads/s3/session*`) is a separate ingestion flow using in-memory session state, not a persistent cloud integration.
- Cloud account uniqueness is enforced globally per provider in `cloud_integrations` via `(provider_id, cloud_account_id)` unique index and runtime checks.
- Current implementation maturity is mixed: automatic AWS flow is end-to-end active, manual flow persists records but has no direct billing ingestion linkage in current code, and admin Cloud Connections UI is placeholder-only.

---

## 2. What “Cloud Connection” Means in KCX

- In implemented backend terms, a cloud connection is not a single table. It is a combination of:
  - provider-specific detail record (`cloud_connections` for automatic AWS, `manual_cloud_connections` for manual AWS), and
  - normalized registry row in `cloud_integrations` for tenant listing/health.
- Persistent account-level integration exists for both automatic and manual AWS paths (records are saved to DB).
- The active cloud-connected ingestion path is AWS Data Exports callback driven (`/api/aws/callback` + `/api/aws/export-file-arrived`) and is tied to `billing_sources` rows with `setup_mode=cloud_connected`.
- Temporary S3 access (`/billing/uploads/s3/session*`) is a separate ingestion flow, not a cloud connection record. Session state is in-memory with TTL.
- Validation outcomes are stored on persistent records (`cloud_connections.status/error_message/last_validated_at`, `manual_cloud_connections.validation_status/status/error_message`) and also reflected in `cloud_integrations`.
- Multi-provider presence is partial: provider catalog includes `aws`, `azure`, `gcp`, `oracle`, `custom`, but implemented setup/validation/integration logic is AWS-focused.

---

## 3. Source of Truth: Tables / Models / Entities

### `cloud_connections` (`CloudConnectionV2`)
- Purpose: automatic connection detail record.
- Key fields: `tenant_id`, `provider_id`, `connection_name`, `status`, `account_type`, `external_id`, `callback_token`, `stack_name`, `stack_id`, `cloud_account_id`, `role_arn`, `export_*`, `connected_at`, `last_validated_at`, `error_message`.
- Persistence type: persistent.
- Ownership: automatic connection setup + validation + callback identity.
- Admin visibility: high.
- Notes: primary for automatic AWS.

### `manual_cloud_connections` (`ManualCloudConnection`)
- Purpose: manual AWS connection record.
- Key fields: `tenant_id`, `connection_name`, `aws_account_id`, `role_arn`, `external_id`, `bucket_name`, `prefix`, `report_name`, `validation_status`, `assume_role_success`, `last_validated_at`, `status`, `error_message`.
- Persistence type: persistent.
- Ownership: manual setup + validation snapshot.
- Admin visibility: high.
- Notes: no direct ingestion run creation linkage found.

### `cloud_integrations` (`CloudIntegration`)
- Purpose: normalized integration registry used for tenant-level listing/health status.
- Key fields: `tenant_id`, `provider_id`, `connection_mode` (`manual|automatic`), `display_name`, `status`, `detail_record_type`, `detail_record_id`, `cloud_account_id`, `status_message`, `error_message`, `last_*` timestamps.
- Persistence type: persistent.
- Ownership: cross-mode registry/monitoring entity.
- Admin visibility: very high (best operational abstraction).
- Notes: unique `(provider_id, cloud_account_id)` enforced globally.

### `billing_sources` (`BillingSource`)
- Purpose: ingestion source descriptor that links integrations/temporary imports to ingestion runs.
- Key fields: `tenant_id`, `cloud_connection_id`, `cloud_provider_id`, `source_type`, `setup_mode`, `is_temporary`, `bucket_name`, `path_prefix`, `status`, `last_validated_at`, `last_file_received_at`, `last_ingested_at`.
- Persistence type: persistent.
- Ownership: ingestion source metadata (cloud-connected/manual/temp).
- Admin visibility: high.

### `raw_billing_files`
- Purpose: per-file ingestion artifact registry.
- Key fields: `billing_source_id`, `source_type`, `setup_mode`, `raw_storage_bucket`, `raw_storage_key`, `file_format`, `status`.
- Persistence type: persistent.
- Ownership: ingestion execution/file tracking.
- Admin visibility: high (for operational debugging).

### `billing_ingestion_runs` + `billing_ingestion_run_files`
- Purpose: execution jobs and run-to-file composition (manifest/data relationships).
- Persistence type: persistent.
- Ownership: ingestion runtime state.
- Admin visibility: high (ingestion monitoring, not connection setup itself).

### In-memory S3 upload session store (`s3-upload-session.store.ts`)
- Purpose: temporary STS-backed browsing/import session state.
- Data: `sessionId`, tenant/user ownership, role/bucket/prefix, temp credentials, `expiresAt`.
- Persistence type: temporary (process memory only).
- Ownership: temporary upload workflow.
- Admin visibility: low/directly unavailable (not DB-backed).

### `cloud_providers`
- Purpose: provider catalog.
- Persistence type: persistent.
- Ownership: metadata.
- Admin visibility: medium.

---

## 4. Current Connection Types / Modes

### Automatic AWS Cloud Connection
- What it is: create `cloud_connections` draft, generate CloudFormation URL, receive callback, validate, sync integration registry, and create/update cloud-connected billing source.
- Active/partial: active.
- Persistent records: yes (`cloud_connections`, `cloud_integrations`, `billing_sources`).
- Flow family: Connect Cloud.

### Manual AWS Connection
- What it is: user submits role/externalId/bucket; backend assumes role + verifies S3 + stores `manual_cloud_connections` and syncs `cloud_integrations`.
- Active/partial: backend active for create+browse; partial for ingestion linkage.
- Persistent records: yes (`manual_cloud_connections`, `cloud_integrations`).
- Flow family: Connect Cloud.

### Temporary S3 Upload Session
- What it is: assume role for temporary session, browse scoped objects, import selected files into ingestion pipeline.
- Active/partial: active.
- Persistent records: temporary session no; ingestion artifacts yes (`billing_sources` temporary row + raw files + runs).
- Flow family: Upload from S3 (not persistent connect-cloud integration).

### AWS Export File Event Callback (manifest)
- What it is: callback endpoint registers manifest/data files as raw files, creates ingestion run, triggers orchestrator.
- Active/partial: active manifest path.
- Persistent records: yes (ingestion artifacts).
- Flow family: cloud-connected ingestion execution.

### `s3_object_created` event-specific direct file queue path
- What it is: `queueExportFileFromEvent` exists.
- Active/partial: partially implemented / currently not called in controller routing logic.
- Persistent records: would persist if called.

---

## 5. Lifecycle of a Cloud Connection

### Explicit backend states
- `cloud_connections.status`: `draft`, `connecting`, `awaiting_validation`, `active`, `active_with_warnings`, `failed`, `suspended`.
- `cloud_integrations.status`: same enum, synced from detail records.
- `manual_cloud_connections.status`: string-based usage includes `draft`, `active`, `failed`, `awaiting_validation`, `suspended` (not strict enum type).

### Automatic lifecycle (implemented)
1. `POST /cloud-connections` -> `draft`.
2. `GET /cloud-connections/:id/aws-cloudformation-url` may move to `connecting`.
3. `/api/aws/callback` stores account/role/export fields, usually sets `awaiting_validation` unless idempotent unchanged path.
4. Async post-callback validation:
- duplicate account check (global provider/account uniqueness),
- STS/identity/S3 checks,
- optional initial backfill queue.
5. Final state commonly `active` / `active_with_warnings` / `failed`; delete callback sets `suspended`.

### Manual lifecycle (implemented + limited)
1. `POST /api/aws/manual/create-connection` performs immediate validation checks.
2. On success inserts record as `status=active`, `validation_status=success`, `assume_role_success=true`.
3. Registry sync maps it to integration status (`active`).
4. No additional lifecycle endpoints for edit/revalidate/list/delete found.

### Temporary session lifecycle
- Session created in memory, tenant+user owned, TTL-clamped.
- Expiry removes session; no DB persistence of session itself.

### Uniqueness / duplicate prevention
- Connection name uniqueness per tenant in `cloud_connections` (`uq_tenant_connection_name`).
- Global cloud account uniqueness by provider in `cloud_integrations` (`uq_cloud_integrations_provider_cloud_account_id`) + service checks.

### UI-only notions
- Some frontend labels are derived (`NOT AVAILABLE`, `HEALTHY`, etc.) from integration status and are not backend enum values.

---

## 6. Backend Implementation Map

### Routes
- `POST /cloud-connections`
- `GET /cloud-connections/:id`
- `GET /cloud-connections/:id/aws-cloudformation-url`
- `POST /cloud-connections/:id/validate`
- `GET /cloud-integrations`
- `POST /api/aws/callback` (no auth; callback token based)
- `POST /api/aws/export-file-arrived` (no auth; payload validation + callback token/account checks)
- `POST /api/aws/manual/create-connection`
- `POST /api/aws/manual/browse-bucket`
- Temporary S3 ingestion: `/billing/uploads/s3/session*`

### Controllers
- `cloud-connections.controller.ts`: automatic setup, callback acceptance, async validation/backfill scheduling, integration listing.
- `manual-connection.controller.ts`: create manual connection and browse bucket.
- `aws-export-file-event.controller.ts`: currently queues manifest path and triggers ingestion.

### Services
- `cloud-integration-registry.service.ts`: sync + uniqueness + status-message mapping.
- `aws-connection-validation.service.ts`: AssumeRole + caller identity + regional/S3 checks.
- `aws-export-ingestion.service.ts`: callback-driven manifest registration, run creation, optional backfill queue.
- `s3-upload.service.ts` + `s3-upload-session.store.ts`: temporary session workflow.

### Validation / DTO / schemas
- Zod schemas in:
  - `cloud-connections.schema.ts`
  - `manual-connection.schema.ts`
  - `aws-export-file-event.schema.ts`
  - `s3-upload.schema.ts`

### External integrations
- AWS STS (`AssumeRole`, `GetCallerIdentity`).
- AWS S3 (`ListObjectsV2`, `GetObject`, `HeadObject`, `GetBucketLocation`).
- AWS EC2 `DescribeRegions` used as validation signal.
- CloudFormation setup URL generator uses template URL + callback params.

### Important business rules
- Callback token is required to bind AWS callbacks to connection.
- Callback account/role/region/bucket are checked against stored connection/source.
- Duplicate provider/account rejected via runtime + DB unique index.
- Automatic callback delete event maps to suspended/disconnected behavior.
- Temporary S3 sessions are ownership-bound (tenant+user) and expire.
- Selected temporary S3 import files must all share one format (`csv` or `parquet`).

---

## 7. Frontend Implementation Map

### Client frontend (implemented)
- Main cloud connection monitoring/listing uses `GET /cloud-integrations` in `ClientBillingPage`.
- Automatic setup uses `POST /cloud-connections` then `GET /cloud-connections/:id/aws-cloudformation-url`.
- Manual setup uses `POST /api/aws/manual/create-connection` and optional bucket browsing via `POST /api/aws/manual/browse-bucket`.
- Temporary S3 upload path in `ManualBillingUploadDialog` uses `/billing/uploads/s3/session*` endpoints.

### Multi-step structure
- Automatic: short form then external CloudFormation launch.
- Manual: UI-guided multi-step IAM/export instructions + test connection; review/success views are UI flow states.

### Status rendering
- Connection table status labels are frontend-mapped from `cloud_integrations.status` and `status_message/error_message`.

### UI-only / not fully backend-backed
- Manual setup instructional steps and success path are heavily UI-driven.
- Admin app `Cloud Connections` route is currently placeholder screen only (no module data wiring).

---

## 8. Business Rules and Operational Constraints

- Duplicate AWS account restriction: enforced globally per provider through `cloud_integrations(provider_id, cloud_account_id)` and service-layer checks.
- Scope: global across tenants (not per-tenant) for provider/account uniqueness.
- Automatic validation requires `roleArn`, `externalId`, and `cloudAccountId` present.
- Manual create requires roleArn/externalId/bucket and validates AssumeRole + bucket access before save.
- Callback payload fields for automatic path are strict (account/role/stack/export metadata).
- Cloud-connected source upsert uses callback payload defaults: `source_type=aws_data_exports_cur2`, `setup_mode=cloud_connected`, `schema_type=cur2_custom`, `format=parquet` unless overridden in callback payload.
- Temporary S3 session TTL is runtime-clamped to 30-60 minutes (from env with clamp logic).
- Temporary sessions are memory-only; process restart invalidates all active sessions.
- Manual connection edit/revalidate/delete operations are not clearly implemented as API endpoints.

---

## 9. Relationship to Billing / Ingestion System

- Cloud connections are configuration/access records; they do not store transformed billing analytics directly.
- Ingestion execution starts when file-level artifacts are created (`raw_billing_files`) and runs are queued (`billing_ingestion_runs`).
- `billing_sources` is the bridge:
  - cloud-connected source for automatic AWS callbacks,
  - temporary source for temporary S3 imports,
  - manual source for local uploads.
- Persistent cloud setup and ingestion events are separate layers:
  - setup/integration lifecycle in cloud connection tables + registry,
  - operational ingestion lifecycle in raw file + run tables.
- Cloud-connected callback ingestion can create manifest-linked multi-file runs using `billing_ingestion_run_files`.

---

## 10. Admin-Relevant Reality Extraction

- Primary operational entity for monitoring is `cloud_integrations` (cross-mode, normalized status/status_message timestamps).
- Secondary drill-down entities:
  - `cloud_connections` for automatic technical fields (callback token, stack, export config),
  - `manual_cloud_connections` for manual role/bucket/validation evidence,
  - `billing_sources` for ingestion linkage and source status.
- Lifecycle events that matter operationally:
  - created/draft,
  - callback received,
  - awaiting_validation,
  - active / active_with_warnings,
  - failed,
  - suspended (delete callback).
- Supporting drill-down context likely needed:
  - provider/account identifiers,
  - role ARN / export bucket-prefix-region,
  - last validated/checked/success timestamps,
  - current error/status message,
  - linked `billing_source` and latest ingestion run health.
- Connection monitoring vs ingestion monitoring split in current code:
  - connection monitoring: `cloud_integrations` + detail tables,
  - ingestion monitoring: `billing_ingestion_runs`, `raw_billing_files`, run-file links, row errors.

---

## 11. Gaps / Partial Areas / Ambiguities

- Manual connection ingestion linkage: backend creates manual connection records, but no direct path found from `manual_cloud_connections` into billing source/run creation (Partially implemented).
- Admin Cloud Connections UI: admin route exists but is placeholder only (Frontend only).
- `s3_object_created` callback path function exists (`queueExportFileFromEvent`) but controller currently always queues manifest flow (Partially implemented).
- Route registration duplication: `aws-export-file-arrived` route is mounted via auto-connection routes and again in app routes (inconsistent wiring, though same handler).
- Environment dependency mismatch: CloudFormation URL builder requires `AWS_FILE_EVENT_CALLBACK_URL`, but this variable is not represented in typed env config and not present in `.env.example` (Not clearly implemented configuration contract).
- Temporary S3 session messaging mismatch: frontend copy says access up to 48 hours, backend TTL is clamped to 30-60 minutes (Frontend only statement inconsistent with backend behavior).
- Legacy/disabled migrations for older cloud connection schemas remain in history (legacy path present, not active runtime path).
- `manual_cloud_connections` lacks explicit DB enum constraints for status fields; status semantics are service-convention based.

---

## 12. Final System Understanding Snapshot

- Primary entity: `cloud_integrations` as tenant-visible integration registry.
- Supporting entities: `cloud_connections` (automatic detail), `manual_cloud_connections` (manual detail), `billing_sources` (ingestion bridge), ingestion artifact tables for runtime operations.
- Connection modes: automatic AWS (active), manual AWS (active but ingestion linkage limited), temporary S3 session import (active, separate from persistent integration).
- Lifecycle truth: explicit statuses exist for automatic/registry; manual status is mapped and less strictly modeled; temporary session lifecycle is in-memory TTL.
- Persistent vs temporary: persistent integrations live in DB tables; temporary S3 access is ephemeral memory state while imported files/runs are persistent.
- Biggest admin-design implication from current reality: do not conflate connection health with ingestion job health; model them as related but distinct operational domains.
