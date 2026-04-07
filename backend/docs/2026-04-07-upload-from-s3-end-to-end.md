# Upload From S3 - End-to-End Process

Date: 2026-04-07  
Scope: `Upload from S3` path in Billing -> Upload CSV flow (frontend + backend + temporary session security + ingestion)

## 1. What this flow does

This flow lets an authenticated tenant user:
1. Enter AWS role + bucket + prefix details.
2. Create a temporary S3 browsing session (session-scoped credentials).
3. Browse/select files inside allowed scope.
4. Queue selected files for ingestion.

Each selected S3 object becomes its own raw file + ingestion run.

---

## 2. UI entry point and states

Primary UI files:
- `frontend/src/features/client-home/pages/ClientBillingPage.tsx`
- `frontend/src/features/client-home/components/ManualBillingUploadDialog.tsx`
- `frontend/src/features/client-home/api/billing-s3-upload.api.ts`

User route:
1. Open `/client/billing/uploads`.
2. Click `Choose Source`.
3. In dialog, choose `Upload from S3`.

S3 UI state machine (`s3Step`):
- `setup`
- `validating`
- `explorer`
- `importing`
- `session_expired`
- `error`

Key S3 form inputs in setup step:
- `Role ARN` (required)
- `Bucket Name` (required)
- `Prefix` (optional)
- `External ID` (optional)

---

## 3. Frontend API calls in S3 flow

### 3.1 Create temporary session
Endpoint:
- `POST /billing/uploads/s3/session`

Payload:
- `roleArn`
- `bucket`
- `prefix` (normalized in frontend/backed)
- `externalId` (optional)

### 3.2 List/browse session scope
Endpoint:
- `GET /billing/uploads/s3/session/:sessionId/list?prefix=<optional>`

Used for:
- initial explorer load after session creation
- folder navigation
- refresh of current folder

### 3.3 Import selected files
Endpoint:
- `POST /billing/uploads/s3/session/:sessionId/import`

Payload:
- `objectKeys: string[]`

On success:
- backend returns `ingestionRunIds[]`
- frontend uses first run id for active polling
- dialog closes and navigates to `/client/billing/uploads`

---

## 4. Frontend behavior details

### 4.1 Prefix normalization (frontend)
Frontend normalizes prefix by:
- trimming
- replacing `\` with `/`
- removing leading `/`

### 4.2 Setup validation (frontend)
Before calling create session:
- roleArn and bucket must be non-empty
- otherwise UI error: `Role ARN and bucket are required.`

### 4.3 Explorer behavior
Explorer table shows:
- folders (click to descend)
- files (checkbox selectable)
- size + modified time

User can:
- refresh current prefix
- change access details (resets session state)
- import selected files

### 4.4 Session-expiry handling in UI
Frontend classifies session expired when error message contains:
- `session expired`, or
- `upload session expired`

Then it moves to `session_expired` step and asks user to revalidate.

### 4.5 Duplicate-import messaging on frontend
Frontend has `isDuplicateImportError()` that checks:
- `payload.error.code` contains `duplicate`, or
- message contains `duplicate` / `already been imported`

Current backend S3 path does not implement explicit duplicate-object detection, so this branch is mostly defensive right now.

---

## 5. Backend endpoints and contracts

Routes file:
- `backend/src/features/billing/billing.routes.ts`

S3 routes:
- `POST /billing/uploads/s3/session`
- `GET /billing/uploads/s3/session/:sessionId/list`
- `POST /billing/uploads/s3/session/:sessionId/import`

All require:
- `requireAuth` middleware (Bearer token + valid session)
- tenant context and user context from `req.auth.user`

Controller:
- `backend/src/features/billing/s3-upload/s3-upload.controller.ts`

Validation strategy:
- controller parses payload/query with Zod schemas via `parseWithSchema`
- schema failures throw `ValidationError` (422)

---

## 6. S3 schema validation rules (Zod)

File:
- `backend/src/features/billing/s3-upload/s3-upload.schema.ts`

### 6.1 Create session schema
- `roleArn`: required, must match AWS IAM role ARN pattern
- `bucket`: required, validated against S3 bucket naming regex
- `externalId`: optional string
- `prefix`: optional, normalized (trim/slash cleanup)

### 6.2 List schema
- `prefix`: optional, normalized

### 6.3 Import schema
- `objectKeys`: array of non-empty strings
- min 1, max 200 keys

---

## 7. Temporary session architecture

Files:
- `s3-upload.service.ts`
- `s3-upload-aws.service.ts`
- `s3-upload-session.store.ts`

### 7.1 Session creation flow (backend)
`createTemporaryS3UploadSession`:
1. Normalize roleArn/bucket/prefix/externalId.
2. Assume role via STS (`AssumeRole`).
3. Validate bucket/prefix access with temp credentials (`ListObjectsV2` probe).
4. Create in-memory session entry in `S3UploadSessionStore`.
5. Return session info to frontend.

Returned data includes:
- `sessionId`
- `bucket`
- `basePrefix`
- `expiresAt`
- `accountId`
- `assumedArn`

### 7.2 Session ownership and access control
`S3UploadSessionStore.getOwnedActiveOrThrow` enforces:
- session exists
- session not expired
- requesting user+tenant exactly match session owner

Failure outcomes:
- not found -> 404
- expired -> 401
- wrong owner -> 403

### 7.3 Session TTL behavior
TTL source:
- `env.billingS3UploadSessionTtlMinutes`

Store clamps TTL to range:
- `min 30 minutes`, `max 60 minutes`

Important mismatch:
- frontend help text says access can remain valid up to 48 hours,
- actual backend implementation enforces max 60 minutes.

### 7.4 Session storage characteristics
- session store is in-process memory (`Map`)
- no persistence across server restarts/redeploys
- cleanup timer removes expired sessions periodically

Implication:
- restart invalidates all active S3 upload sessions.

---

## 8. AWS credential + scope security model

### 8.1 Base credentials used to assume role
`assumeRoleForUploadSession` uses backend "validation" credentials:
- `AWS_VALIDATION_ACCESS_KEY_ID`
- `AWS_VALIDATION_SECRET_ACCESS_KEY`
- optional `AWS_VALIDATION_SESSION_TOKEN`

Fallback behavior:
- if validation vars absent, fallback to standard `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / session token.

### 8.2 Bucket region resolution
Region resolution uses `GetBucketLocation`, with fallback extraction from AWS error headers (`x-amz-bucket-region`).

### 8.3 Scope normalization and enforcement
Security helpers:
- normalize prefix and keys
- enforce key inside base prefix

Out-of-scope request examples rejected:
- listing prefix outside base scope
- importing object key outside base scope

### 8.4 Selected object validation
Before import, backend validates each selected key by:
1. key shape checks (no leading `/`, no `\`, not ending `/`)
2. base-prefix scope check
3. `HeadObject` call to verify accessibility and collect metadata

---

## 9. Browse/list flow details

Function:
- `listTemporaryS3UploadSessionScope`

Process:
1. Load active owned session.
2. Normalize + authorize requested prefix against session base prefix.
3. List objects with `ListObjectsV2` (`Delimiter: "/"`, `MaxKeys: 200`).
4. Return merged explorer items:
   - folders from `CommonPrefixes`
   - files from `Contents`

Listing response contains:
- `sessionId`
- `bucket`
- `basePrefix`
- `currentPrefix`
- `expiresAt`
- `items[]` (`folder` or `file`)

---

## 10. Import flow details (core)

Function:
- `importFilesFromTemporaryS3UploadSession`

### 10.1 Preconditions
- valid active session owned by same user+tenant
- at least one selected key
- all selected keys accessible and in scope
- all selected files must share one format (`csv` or `parquet`)

If mixed formats selected:
- backend throws `BadRequestError`:
  - `Selected files must all have the same file format (csv or parquet)`

### 10.2 Cloud provider resolution
Backend ensures AWS provider row exists:
- `CloudProvider.findOrCreate({ code: "aws" ... })`

### 10.3 Transactional DB creation (session import records)
Inside DB transaction:
1. Create one new `billing_sources` row:
   - `sourceType = "s3"`
   - `setupMode = "temporary"`
   - `isTemporary = true`
   - `status = "active"`
   - `bucketName = session.bucket`
   - `pathPrefix = session.basePrefix`
   - `format = single detected format`
   - `schemaType = "focus"`
   - `cadence = "manual"`
   - `sourceName = "Temporary S3 Upload <timestamp>"`
2. For each selected object, create `raw_billing_files` row:
   - `billingSourceId` = new source
   - `tenantId`
   - `cloudProviderId` (aws)
   - `sourceType = "s3"`
   - `setupMode = "temporary"`
   - `uploadedBy = userId`
   - `originalFileName` = basename(key)
   - `originalFilePath` = full key
   - `rawStorageBucket` = session bucket
   - `rawStorageKey` = object key
   - `fileFormat` from key extension
   - `fileSizeBytes` from HeadObject content-length
   - `status = "stored"`

If transaction fails:
- rollback
- throw `InternalServerError("Failed to create temporary S3 upload records")`

### 10.4 Ingestion fan-out
After commit:
- creates one ingestion run per raw file (`createIngestionRun`)
- schedules each via `setImmediate(() => ingestionOrchestrator.processIngestionRun(run.id))`

Response returns:
- `sessionId`
- `billingSourceId`
- `selectedFileCount`
- `rawFileIds[]`
- `ingestionRunIds[]`

---

## 11. Ingestion behavior after S3 import

The ingestion engine is the same orchestrator used by local uploads:
- `backend/src/features/billing/services/ingestion-orchestrator.service.ts`

Per file run lifecycle:
- queued -> validating_schema -> reading_rows -> normalizing -> upserting_dimensions -> inserting_facts -> finalizing -> terminal status

Terminal statuses:
- `completed`
- `completed_with_warnings`
- `failed`

Row-level failures are recorded in:
- `billing_ingestion_row_errors`

---

## 12. Frontend post-import lifecycle

In `ManualBillingUploadDialog` + `ClientBillingPage`:
1. On import success, frontend takes first run id and triggers `onIngestionQueued`.
2. Active run id stored in localStorage key `kcx.activeBillingIngestionRunId`.
3. Billing page polls `GET /billing/ingestions/:id/status` via `useIngestionStatus`.
4. Upload history query is invalidated/refreshed.

Notes:
- If multiple files are imported, frontend tracks only first ingestion run id for active polling indicator.
- All runs still appear in upload history table once fetched.

---

## 13. Data model impact (S3 import)

Tables written:
1. `billing_sources` (new temporary source per import action)
2. `raw_billing_files` (one per selected object)
3. `billing_ingestion_runs` (one per selected object)
4. `billing_ingestion_run_files` (one per run)
5. downstream dim/fact tables during orchestrator
6. `billing_ingestion_row_errors` for row failures

S3-specific source semantics:
- `source_type = s3`
- `setup_mode = temporary`
- `is_temporary = true`

---

## 14. Config dependencies for S3 upload path

Required/used by this flow:
- STS assume-role base creds:
  - `AWS_VALIDATION_ACCESS_KEY_ID` / `AWS_VALIDATION_SECRET_ACCESS_KEY` (or fallback AWS creds)
- region defaults:
  - `AWS_REGION`
- session TTL:
  - `BILLING_S3_UPLOAD_SESSION_TTL_MINUTES` (clamped to 30..60)

Also required downstream for ingestion reads:
- backend AWS access to read selected S3 objects during ingestion.

---

## 15. Edge cases and important implementation notes

1. UI TTL text mismatch:
- UI says temp access can last up to 48h.
- backend caps to 60 minutes.

2. Session persistence:
- session store is memory-only, process-local.
- server restart invalidates sessions.

3. Duplicate imports:
- no explicit dedupe/uniqueness guard for same object key import across sessions.
- frontend duplicate error UI exists but backend currently has no dedicated duplicate check in this path.

4. Format constraints:
- all selected files in a single import request must share same extension format.

5. File format detection method:
- based on filename extension (via key), not content-sniffing.

6. Explorer pagination cap:
- list API uses `MaxKeys: 200` and currently does not expose continuation token pagination.

7. Stored credentials scope:
- temporary assumed-role credentials are stored in session object in memory until expiry/cleanup.

---

## 16. End-to-end sequence summary (short)

1. User enters role/bucket/prefix and validates.
2. Backend assumes role, validates scope access, creates session.
3. User browses scoped objects and selects files.
4. Backend validates selected keys with scope + HeadObject checks.
5. Backend creates temporary source + raw file records in one transaction.
6. Backend creates one ingestion run per selected object.
7. Orchestrator processes each run asynchronously.
8. Frontend tracks run status (first run id) and shows all runs in upload history.
