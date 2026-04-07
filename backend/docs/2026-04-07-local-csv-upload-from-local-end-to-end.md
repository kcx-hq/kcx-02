# Local CSV Upload (From Local) - End-to-End Process

Date: 2026-04-07  
Scope: `Upload from Local` path in Billing -> Upload CSV flow (frontend + backend + ingestion pipeline)

## 1. What this flow does

This flow lets an authenticated tenant user upload a billing file from their device, store it in S3 raw storage, create an ingestion run, and process the file into analytics tables.

Important implementation detail:
- UI label says "Upload CSV", but local upload currently accepts both `.csv` and `.parquet` files.

---

## 2. Entry point (UI)

Primary page:
- `frontend/src/features/client-home/pages/ClientBillingPage.tsx`

Dialog component:
- `frontend/src/features/client-home/components/ManualBillingUploadDialog.tsx`

How user reaches it:
1. User opens route `/client/billing/uploads`.
2. User clicks `Choose Source`.
3. `ManualBillingUploadDialog` opens.
4. In dialog, user keeps `Upload from Local` selected (default).

Local mode UI fields:
- Cloud Provider dropdown
- Billing File input (`accept=".csv,.parquet"`)
- Upload button

---

## 3. Frontend local-flow behavior (exact)

### 3.1 Load providers
When dialog is open and source is `local`:
- frontend calls `GET /billing/cloud-providers`
- response populates dropdown
- if any providers exist, first provider is auto-selected

### 3.2 Local validation before submit
Submit is enabled only when all are true:
- not currently submitting
- provider list finished loading
- `selectedProviderId` exists
- `file` exists

### 3.3 Submit payload
On `Upload File` click:
- builds `FormData`
- appends:
  - `file` (binary)
  - `cloudProviderId` (string)
- sends `POST /billing/ingestion/upload` via `apiPostForm`

### 3.4 Success handling
On success:
- dialog shows: `Upload queued successfully. Ingestion run ID: <id>`
- parent callback `onIngestionQueued` is fired with run id
- selected file is cleared

In parent page (`ClientBillingPage`), `handleIngestionQueued` then:
- stores run id into local state
- stores run id in localStorage key `kcx.activeBillingIngestionRunId`
- invalidates upload history query (`["billing","upload-history"]`)

### 3.5 Error handling
If request fails:
- `ApiError.message` is shown
- fallback message: `Failed to upload file`

---

## 4. Backend API endpoints used by local upload

Routes file:
- `backend/src/features/billing/billing.routes.ts`

Local-upload related endpoints:
- `GET /billing/cloud-providers`
- `POST /billing/ingestion/upload` (multipart form)
- `GET /billing/ingestions/latest-active`
- `GET /billing/ingestions/:id/status`
- `GET /billing/uploads/history`

Auth requirement:
- all billing routes use `requireAuth`
- requires Bearer token + valid non-expired auth session

---

## 5. Multipart upload endpoint internals

Controller:
- `handleManualUploadBillingFile` in `backend/src/features/billing/billing.controller.ts`

Route middleware:
- multer memory storage (`upload.single("file")`)
- file limit: 1 file
- file size limit: `75 * 1024 * 1024` (75 MB)

Request contract:
- required multipart fields:
  - `file`
  - `cloudProviderId`

Validation in controller:
1. Tenant context must exist (`req.auth.user.tenantId`) or request is rejected.
2. `file` must exist.
3. `cloudProviderId` must be non-empty string.
4. `cloudProviderId` must be numeric (`/^\d+$/`).

File format detection:
- based on filename extension only
- allowed: `.csv`, `.parquet`
- otherwise: `Unsupported format. Only csv and parquet files are allowed`

---

## 6. Billing source resolution (manual source)

Service:
- `backend/src/features/billing/services/billing-source.service.ts`

Process:
1. Validates provider id is numeric.
2. Confirms provider exists in `cloud_providers`.
3. Looks for existing manual source matching:
   - same `tenantId`
   - same `cloudProviderId`
   - `sourceType = "manual_upload"`
   - `setupMode = "manual"`
   - same `format` (`csv` or `parquet`)
4. If not found, creates a new source with:
   - `sourceName = "Manual <PROVIDER_NAME_UPPERCASE> Upload"`
   - `schemaType = "focus"`
   - `cadence = "manual"`
   - `status = "draft"`

---

## 7. Raw file storage (S3 + DB)

Service:
- `backend/src/features/billing/services/raw-file.service.ts`

### 7.1 Preconditions
- file buffer must be present and non-empty
- env var `RAW_BILLING_FILES_BUCKET` must be set
- billing source must exist and belong to current tenant
- billing source must have valid `cloudProviderId`

### 7.2 S3 object key format
Generated key pattern:
- `<tenant>/<provider>/<manual_upload>/<YYYY>/<MM>/<DD>/<timestamp>_<sanitized_filename>`

Example shape:
- `tenant-a/aws/manual_upload/2026/04/07/1712470000000_mybilling.csv`

### 7.3 S3 upload
- Uses AWS SDK `PutObjectCommand`
- Bucket = `RAW_BILLING_FILES_BUCKET`
- Key = generated key above
- ContentType = uploaded file mimetype or `application/octet-stream`

### 7.4 Raw file DB row (`raw_billing_files`)
Inserted fields include:
- `billing_source_id`
- `tenant_id`
- `cloud_provider_id`
- `source_type`
- `setup_mode`
- `uploaded_by` (auth user id if available)
- `original_file_name`
- `original_file_path = null` (local upload path is not persisted)
- `raw_storage_bucket`
- `raw_storage_key`
- `file_format`
- `file_size_bytes`
- `status = "stored"`

---

## 8. Ingestion run creation + async kickoff

Service:
- `backend/src/features/billing/services/ingestion.service.ts`

Created ingestion run values:
- `status = "queued"`
- `currentStep = "queued"`
- `progressPercent = 5`
- `statusMessage = "Your billing file is queued for processing"`
- `lastHeartbeatAt = now`

Also creates run-file link (`billing_ingestion_run_files`):
- `fileRole = "data"`
- `processingOrder = 0`

Then controller queues async processing:
- `setImmediate(() => ingestionOrchestrator.processIngestionRun(run.id))`

Immediate HTTP response (`201`):
- `ingestionRunId`
- `status`
- `billingSourceId`
- `rawFileId`
- `format`
- `startedAt`

---

## 9. Ingestion orchestrator pipeline (core ETL)

Service:
- `backend/src/features/billing/services/ingestion-orchestrator.service.ts`

### 9.1 Stage model and progress
Configured stage progress:
- queued: 5
- validating_schema: 10
- reading_rows: 25
- normalizing: 45
- upserting_dimensions: 65
- inserting_facts: 85
- finalizing: 95
- completed/completed_with_warnings: 100

Status updates are heartbeat-driven and throttled by env:
- `BILLING_INGESTION_STATUS_MIN_INTERVAL_MS` (default 2000)

### 9.2 Preliminary checks
For a local upload run:
1. load ingestion run
2. load run-file links
3. if any file link role is `manifest`, switch to AWS export processor path (not local CSV path)
4. load raw file record
5. ensure bucket/key exist on raw file record
6. resolve format from DB record + S3 key extension; mismatch fails
7. verify object exists in S3 via `HeadObject`

### 9.3 Schema validation
Reader service:
- CSV: reads header row only
- Parquet: reads schema columns

Validator service:
- maps input headers to canonical columns using exact/case-insensitive/normalized/alias matching
- unknown + ambiguous headers are collected
- success criterion is currently only missing required columns

Current required columns list:
- empty (`REQUIRED_COLUMNS = []`)

Practical implication:
- schema step is permissive currently; unknown/ambiguous headers are not fatal by themselves because no required columns are enforced.

### 9.4 Chunk reading
Chunk size from env:
- `BILLING_INGESTION_BATCH_SIZE` (default 1000)

CSV behavior:
- streamed parse with `csv-parser`
- yields chunks incrementally

Parquet behavior:
- reads full rows into memory then slices into chunks
- primary parser `parquetjs-lite`, fallback `parquet-wasm` + Arrow

### 9.5 Row normalization
For each row in chunk:
- row normalized to canonical schema
- missing mapped columns become `null`
- helper fields derived:
  - `usage_start_time`
  - `usage_end_time`
  - `line_item_type`
  - `pricing_term`
  - `public_on_demand_cost`
  - computed `discount_amount = max(ListCost - EffectiveCost, 0)` when both numeric

### 9.6 Dimension resolution
Service:
- `dimension-upsert.service.ts`

Per chunk:
- primes in-memory cache with bulk lookup/create for dim tables

Dimensions resolved:
- `dim_billing_account`
- `dim_sub_account`
- `dim_region`
- `dim_service`
- `dim_resource`
- `dim_sku`
- `dim_charge`
- `dim_date` (usage/billing period dates)

### 9.7 Fact insertion
Service:
- `fact-cost-line-item.service.ts`

Flow:
1. build fact payload from normalized row + resolved dimension keys
2. attempt `bulkCreate` for chunk
3. if bulk fails, retry row-by-row
4. classify row insert errors into:
   - `numeric_overflow`
   - `value_too_long`
   - `fact_insert_error`

Numeric sanitation:
- key fact numeric fields are sanitized to numeric(18,6)-safe values
- invalid numeric throws `invalid_numeric`
- overflow throws `numeric_overflow`

### 9.8 Row error persistence
Service:
- `ingestion-row-error.service.ts`

Any failed row is written to `billing_ingestion_row_errors` with:
- ingestion run id
- raw file id
- row number
- error code
- error message
- raw row JSON snapshot

### 9.9 Finalization rules
After all chunks:
- moves to `finalizing`
- if `rowsLoaded === 0` and `rowsFailed > 0` -> mark run `failed`
- else:
  - `rowsFailed > 0` -> `completed_with_warnings`
  - `rowsFailed = 0` -> `completed`
- warning/failure summaries include top failure reasons by frequency

---

## 10. Post-upload UI lifecycle

### 10.1 Active run recovery
On page load, if no active run in local state:
- frontend calls `GET /billing/ingestions/latest-active`
- if found, resumes tracking

### 10.2 Polling status
Hook:
- `useIngestionStatus`

Polling cadence:
- first 30s: every 2s
- after 30s: every 5s

Terminal statuses:
- `completed`
- `completed_with_warnings`
- `failed`

When terminal reached:
- active ingestion run id removed from localStorage
- UI keeps last terminal status for display

### 10.3 Upload history table
Data endpoint:
- `GET /billing/uploads/history`

Server-side status mapping shown in table:
- `queued` -> queued
- `failed` -> failed
- `completed_with_warnings` OR completed+failedRows>0 -> warning
- `completed` -> completed
- everything else -> processing

Actions available in UI:
- `View details` (loads `/billing/ingestions/:id/status`)
- `Retry` button shown for `failed`/`warning` rows (reopens upload dialog)
- select uploaded files and open dashboard scope

---

## 11. Tables touched in local upload

Write path touches these tables:
1. `billing_sources` (maybe insert if first manual source for provider+format)
2. `raw_billing_files` (always insert)
3. `billing_ingestion_runs` (always insert + many updates)
4. `billing_ingestion_run_files` (always insert one `data` link)
5. dimension tables (`dim_*`) during ingestion
6. `fact_cost_line_items`
7. `billing_ingestion_row_errors` (when row-level failures happen)

---

## 12. Key config dependencies

From backend env/config:
- `RAW_BILLING_FILES_BUCKET` (required for local upload)
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (+ optional session token)
- `AWS_S3_ENDPOINT`, `AWS_S3_FORCE_PATH_STYLE` (optional; useful for S3-compatible storage)
- `BILLING_INGESTION_BATCH_SIZE` (default 1000)
- `BILLING_INGESTION_STATUS_MIN_INTERVAL_MS` (default 2000)

Note:
- `backend/.env.example` documents ingestion batch/status vars but currently does not list `RAW_BILLING_FILES_BUCKET`, even though code requires it.

---

## 13. Observed edge cases and implementation notes

1. UI wording vs behavior:
- UI says "Upload CSV" but accepts `.csv,.parquet`.

2. File type validation:
- backend trusts filename extension for format check.
- content-level MIME/signature validation is not currently enforced.

3. Memory behavior:
- upload endpoint keeps file in memory (`multer.memoryStorage`).
- parquet full-row read path currently loads full dataset before chunking.

4. Schema strictness currently relaxed:
- required columns list is empty.
- rows with missing/invalid values fail later at transform/insert level.

5. Duplicate handling for local uploads:
- no explicit local-file dedupe in this path (no checksum dedupe check in controller/service path).

6. Retry action semantics:
- retry in history UI simply reopens upload dialog; it does not automatically re-submit prior file.

---

## 14. End-to-end sequence summary (short)

1. User selects local provider + file and submits.
2. Backend validates auth, file, provider id, extension.
3. Backend gets/creates manual `billing_source`.
4. Backend uploads raw object to S3 and inserts `raw_billing_files`.
5. Backend inserts `billing_ingestion_runs` + `billing_ingestion_run_files`.
6. Backend responds immediately with queued run id.
7. Async orchestrator validates schema, reads chunks, normalizes rows.
8. Dimensions are resolved/upserted; facts inserted.
9. Row failures are logged to `billing_ingestion_row_errors`.
10. Run ends as `completed`, `completed_with_warnings`, or `failed`.
11. Frontend polls status and updates upload history/details.
