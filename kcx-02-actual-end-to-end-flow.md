# KCX-02 Actual End-to-End Working Flow

Repository analyzed: `kcx-v2` (frontend + backend)

## 1. System Entry Points

- Public UI entry points
  - Landing and marketing pages (public routes)
  - Demo request flow (`/schedule-demo`)
  - Authentication pages (`/login`, `/forgot-password`, `/reset-password`)
- Protected UI entry points
  - Client workspace routes under `/client/*` (overview, cost explorer, billing/upload flows, settings)
- API entry points used by frontend
  - Auth: `/auth/*`
  - Demo scheduling: `/schedule-demo/*`
  - AWS connection: `/cloud-connections/*`, `/cloud-integrations/*`, `/api/aws/manual/*`
  - Billing ingestion/upload: `/billing/*`
  - Dashboard data: `/dashboard/*`, `/upload-dashboard/*`
- Async/system entry points
  - AWS callback: `/api/aws/callback`
  - AWS export/cloudtrail event callback: `/api/aws/export-file-arrived`
  - Server-started background schedulers/processors for recommendations/actions

## 2. Core User Journeys (step-by-step)

### Journey A: Landing Page -> Demo Request -> User Creation -> First Login

1. User Action -> User opens landing/demo page and selects a demo slot.
2. Frontend -> Slot picker requests available slots for selected date/timezone.
3. API -> `GET /schedule-demo/slots/:date` (or `/schedule-demo/slots`).
4. Backend -> Service fetches/derives slot availability (Cal.com integration path).
5. DB/AWS -> No tenant data change yet.
6. Response -> Available slots returned to frontend.
7. UI -> User confirms slot and submits company/user details.
8. API -> `POST /schedule-demo`.
9. Backend -> Reserves slot, creates or reuses tenant, creates user record, saves demo request + slot reservation.
10. DB/AWS -> `tenants`, `users`, `demo_requests`, `slot_reservations` updated in transaction.
11. Response -> Booking accepted with confirmation details.
12. UI -> Confirmation/success state shown.

### Journey B: Authentication Flow (Login, Session Validation, Reset)

1. User Action -> User submits email/password on login page.
2. Frontend -> Calls login API and awaits session payload.
3. API -> `POST /auth/login`.
4. Backend -> Validates user status/password, creates auth session token with expiry.
5. DB/AWS -> `auth_sessions` inserted/updated.
6. Response -> Token + user profile + expiry returned.
7. UI -> Frontend stores token/user/expiry locally and navigates to `/client/overview`.
8. User Action -> User reloads/opens protected page.
9. Frontend -> Guard checks local token and calls current-user endpoint.
10. API -> `GET /auth/me` with bearer token.
11. Backend -> `requireAuth` validates token hash + expiry against session store.
12. DB/AWS -> `auth_sessions` and `users` lookup.
13. Response -> Authorized user context returned (or 401).
14. UI -> Protected app renders on success, otherwise redirected to `/login`.

Forgot/reset sub-flow:
1. User Action -> User requests password reset.
2. Frontend -> Sends email input.
3. API -> `POST /auth/forgot-password`.
4. Backend -> Creates reset token and sends reset email.
5. DB/AWS -> Password reset token record stored.
6. Response -> Success response (non-enumerating style).
7. User Action -> User submits new password from reset link.
8. API -> `POST /auth/reset-password`.
9. Backend -> Validates token, updates password hash, revokes old sessions.
10. DB/AWS -> `users` password updated, reset token consumed, sessions revoked.
11. UI -> User returns to login and authenticates with new password.

### Journey C: AWS Cloud Connection (Automatic)

1. User Action -> User chooses automatic AWS setup and enters connection details.
2. Frontend -> Creates draft cloud connection.
3. API -> `POST /cloud-connections`.
4. Backend -> Creates draft connection with generated external identifiers/tokens; syncs cloud integration record.
5. DB/AWS -> `cloud_connections_v2` and integration tracking records inserted/updated.
6. Response -> Connection ID returned.
7. Frontend -> Requests AWS CloudFormation console URL.
8. API -> `POST /cloud-connections/:id/aws-cloudformation-url`.
9. Backend -> Generates parameterized CloudFormation launch URL and marks status as connecting.
10. DB/AWS -> Connection status updated.
11. Response -> Launch URL returned.
12. UI -> Frontend opens AWS console in new tab.
13. AWS/System Action -> Stack deployment triggers callback into platform.
14. API -> `POST /api/aws/callback`.
15. Backend -> Verifies callback token/payload, upserts billing/cloudtrail sources, updates connection/integration status, optionally schedules initial validation/backfill.
16. DB/AWS -> Billing source/cloudtrail source/connection status persisted.
17. UI -> Connection appears connected/validated in app after status refresh.

### Journey D: AWS Cloud Connection (Manual)

1. User Action -> User follows manual setup wizard.
2. Frontend -> Builds guided trust/policy/bucket/account steps; captures inputs.
3. API -> `POST /api/aws/manual/complete-setup` (current UI path).
4. Backend -> Validates role/account/bucket access (billing and optional cloudtrail), then upserts manual completion data and integration state.
5. DB/AWS -> Manual connection + integration records updated.
6. Response -> Setup completion response.
7. UI -> User is routed to manual setup success page.

### Journey E: Billing Upload (Local File)

1. User Action -> User opens billing upload dialog and chooses local file upload.
2. Frontend -> Fetches supported cloud providers.
3. API -> `GET /billing/cloud-providers`.
4. Backend -> Returns provider list.
5. UI -> User selects provider + file and submits.
6. API -> `POST /billing/ingestion/upload` (multipart with `file` and `cloudProviderId`).
7. Backend -> Detects format, creates raw file/source records, creates ingestion run, queues async orchestrator processing.
8. DB/AWS -> Raw file metadata persisted; object stored in raw billing storage; ingestion run row created.
9. Response -> Returns ingestion run ID/raw file IDs.
10. UI -> Frontend navigates to uploads dashboard and starts polling ingestion status.
11. API -> `GET /billing/ingestions/:id/status` (polling).
12. Backend -> Returns current stage/state until terminal.
13. UI -> Status/progress updates, then processed data appears in upload dashboard views.

### Journey F: Billing Upload (S3 Import)

Temporary session path:
1. User Action -> User chooses S3 import and provides role/bucket/prefix info.
2. Frontend -> Creates temporary import session.
3. API -> `POST /billing/uploads/s3/session`.
4. Backend -> Assumes role, validates S3 access scope, creates temp session.
5. Response -> Session ID returned.
6. Frontend -> Lists importable objects.
7. API -> `GET /billing/uploads/s3/session/:sessionId/list`.
8. Backend -> Lists objects under validated scope.
9. UI -> User selects objects and starts import.
10. API -> `POST /billing/uploads/s3/session/:sessionId/import`.
11. Backend -> Copies selected objects into platform raw storage, creates raw file rows + ingestion runs, starts orchestrator.
12. DB/AWS -> Internal raw storage + ingestion tables updated.
13. Response -> Run/file IDs returned.
14. UI -> Upload dashboard opens with status and data once processing completes.

Persistent connection path:
1. User Action -> User saves reusable S3 connection.
2. API -> `POST /billing/uploads/s3/connections`.
3. Backend -> Validates and stores persistent connection metadata.
4. DB/AWS -> Connection row persisted.
5. Frontend -> Reuses it via `POST /billing/uploads/s3/connections/:connectionId/session` then follows the same list/import sequence above.

### Journey G: Dashboard Data Flow (How Data Reaches UI)

1. User Action -> User opens overview/cost explorer/upload dashboard.
2. Frontend -> Builds scope from URL + tenant context and requests scope resolution.
3. API -> `GET /dashboard/scope` (or upload-dashboard scope path).
4. Backend -> Resolves scope using tenant + optional billingSourceIds/rawBillingFileIds/date range, including ingestion-run constraints for upload-specific views.
5. DB/AWS -> Reads scope anchors (ingestion runs, file mappings, date bounds).
6. Response -> Effective scope returned.
7. Frontend -> Executes page data queries with resolved scope.
8. API -> `/dashboard/overview`, `/dashboard/cost-explorer/*`, `/upload-dashboard/*`.
9. Backend -> Aggregates from fact/dimension/aggregation/recommendation/anomaly tables based on scope.
10. DB/AWS -> SQL reads from analytics tables.
11. Response -> Structured chart/table datasets returned.
12. UI -> Widgets/charts/tables render and refresh on filter/scope changes.

## 3. Data Movement & Processing

### Billing data pipeline (implemented)

1. Ingestion run created (from local upload, S3 import, or AWS export event).
2. Orchestrator picks run and advances staged statuses.
3. File/schema validation is performed.
4. Rows are parsed and normalized.
5. Dimensions are upserted.
6. Fact cost line items are inserted.
7. Row-level errors/warnings are recorded.
8. Finalization computes/updates downstream aggregations and status (`completed`, `completed_with_warnings`, or `failed`).
9. Recommendation sync hooks are triggered after ingestion finalization.

### Event-driven ingestion path (implemented)

1. AWS emits export/cloudtrail event to callback endpoint.
2. Backend identifies source type (`aws_data_exports_cur2` or `aws_cloudtrail`).
3. Billing export path registers manifest/data file records and creates ingestion run.
4. Cloudtrail path registers pending marker and background processor claims/reads objects.
5. Parsed cloud events are deduplicated and persisted.
6. Final statuses/errors are persisted for observability and retries.

### Request/response data shaping to UI

1. Frontend sends scoped query params (tenant/date/source/file IDs).
2. Backend request builders normalize and validate scope.
3. Repository queries aggregate at endpoint-specific granularity.
4. Responses return UI-ready KPI/time-series/breakdown structures.
5. React Query caches and re-renders components when filters change.

## 4. Integration Touchpoints (AWS, DB, etc.)

- AWS integrations
  - STS AssumeRole and identity verification for connection validation/import sessions.
  - S3 list/read/copy operations for billing file discovery and ingestion.
  - CloudFormation launch URL generation for automatic onboarding.
  - Callback/event intake endpoints for stack completion and export/cloudtrail arrivals.
- Database integrations
  - Core app entities: users, tenants, auth sessions, demo requests, cloud connections, integration registry, billing sources.
  - Pipeline entities: raw files, ingestion runs, row errors, cloud event markers.
  - Analytics entities: fact cost line items, dimensions, aggregate tables, anomalies, recommendations.
- External service integrations
  - Cal.com for demo slot reservation flow.
  - Mail service (Mailgun path) for demo notifications/password reset/invites.

## 5. Current System Capabilities

- Implemented and active
  - Public-to-product journey: demo request with slot booking and tenant/user record creation.
  - Full auth lifecycle: login, session validation (`/auth/me`), forgot/reset password.
  - AWS onboarding: automatic setup with CloudFormation callback lifecycle.
  - AWS manual onboarding: wizard-backed completion endpoint with backend validation/persist.
  - Billing ingestion from local files and S3 imports (temporary + persistent connection modes).
  - Ingestion monitoring endpoints for active/latest run status and upload history.
  - Dashboard and upload-dashboard data delivery from processed fact/dimension/aggregate data.
  - Event-driven backend processing for AWS export file arrival and cloudtrail ingestion.
  - Background processors/schedulers for recommendations/actions started with server runtime.

- Not included in this document
  - Theoretical architecture or planned modules not exercised by implemented request flows.
  - Code-level implementation details/snippets.
