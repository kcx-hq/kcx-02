# KCX Backend Implementation Inventory (As Implemented)

## 1. Overview

The backend is an Express + TypeScript service with Sequelize/PostgreSQL persistence and S3-based raw file storage. It implements a full tenant-aware flow for:

- Authentication and organization access control
- Demo scheduling and admin confirmation lifecycle
- AWS cloud connection onboarding (automatic and manual)
- Billing ingestion from manual upload, temporary S3 import, and AWS export callbacks
- Analytics APIs (overview, cost explorer, budgets, anomalies, optimization)
- Support workflows (tickets and meetings)
- Admin operational APIs (clients, billing uploads, cloud connections, announcements)

This document describes only mounted and operational backend behavior. Unmounted/duplicate route/controller files are intentionally excluded.

## 2. Modules Implemented

### 2.1 Identity and Access

- User auth (`/auth/*`): login, current-session identity, forgot/reset password.
- Session model uses hashed bearer tokens with expiry (`AuthSession`); admin sessions use `AdminAuthSession`.
- Password reset flow stores hashed reset tokens and revokes existing sessions on successful reset.
- Organization user lifecycle (`/organization/users/*`): invite, approve, activate/deactivate with protections (cannot self-deactivate, cannot deactivate primary admin).
- Separate admin auth (`/admin/auth/*`) validates configured admin credentials and persists admin sessions.

### 2.2 Demo Scheduling and Conversion

- Public demo slot discovery and booking request intake via Cal.com.
- `DemoRequest` + `SlotReservation` are persisted for workflow control.
- Admin module confirms/rejects requests:
  - Confirm: converts reservation to Cal.com booking and updates request status.
  - Reject: marks request rejected and releases reservation.
- Email notifications are sent for intake, confirmation, rejection, and org invite flows.

### 2.3 Cloud Connections (AWS)

#### Automatic AWS Connection

- Draft cloud connection creation (`/cloud-connections`) with generated `externalId`, callback token, and stack name.
- CloudFormation setup URL generation endpoint supports billing export and optional CloudTrail/action-role options.
- Callback endpoint (`/api/aws/callback`) accepts stack create/update/delete outcomes and upserts:
  - connection core fields
  - billing source (`aws_data_exports_cur2`)
  - optional cloudtrail source (`aws_cloudtrail`)
- Post-callback validation and initial backfill are scheduled idempotently.
- Cloud integration registry rows are synced to reflect effective status (`draft`, `awaiting_validation`, `active`, `active_with_warnings`, `failed`, `suspended`).

#### Manual AWS Connection

- Manual wizard flow endpoints:
  - create connection (assume role + bucket access validation + uniqueness checks)
  - browse bucket
  - complete setup (full payload persistence + pre-validation)
- Completion persists full setup payload including billing export and optional cloudtrail/action-role sections.
- Manual cloud integration rows are synced from manual connection state.

#### AWS Runtime Operations

- EC2 instance APIs: list/start/stop/reboot/change instance type.
- Rightsizing execution uses instance-type change workflow with operational guards (state and ASG checks in EC2 service).
- Idle action executors call implemented operations for EBS delete, EIP release, and snapshot delete.

### 2.4 Billing Upload and Ingestion

#### Upload Sources

- Manual file upload (`multipart/form-data`) to raw S3 bucket.
- Temporary S3 import sessions:
  - Assume role using backend validation credentials
  - Validate bucket/prefix scope
  - List scoped files
  - Import selected objects into raw billing bucket
  - Create temporary billing source and ingestion runs
- AWS export callback ingestion:
  - `manifest_created` path parses `Manifest.json` and queues parquet files
  - CloudTrail object path queues file-marker events for background processing

#### Ingestion Orchestration

- Core ingestion orchestrator stages:
  - schema validation
  - row reading/chunking
  - row normalization
  - dimension priming/upsert
  - fact insertion with row-level fallback
  - row error recording
  - aggregate table upserts (hourly/daily/monthly)
  - completion/failure status transitions with progress updates
- Manifest-linked runs are delegated to AWS export parquet processor.
- On successful run completion:
  - anomaly detection run is created and started
  - optimization sync hooks run for rightsizing/idle refresh

### 2.5 Dashboard and Analytics

#### Main Dashboard

- Scope resolver supports:
  - upload-scoped analytics (raw file IDs -> latest successful ingestion runs)
  - global date-range scope (optionally filtered by provider/billing source/dim keys)
- Overview APIs are data-backed from facts/anomalies/recommendations/budgets.
- Cost explorer supports granularity, grouping, comparison series (previous-month/budget/forecast), and upload/global scope behavior.
- Budget APIs support create/update/status updates and budget-vs-actual data consumption.
- Anomaly APIs support manual run creation, run status lookup, and anomaly listing.
- Optimization APIs support:
  - rightsizing, idle, and commitment overview/list/detail
  - recommendation sync triggers
  - recommendation ignore actions
  - queued action execution (rightsizing + idle) and action status polling

#### Upload Dashboard

- Mounted endpoints for upload dashboard overview, cost explorer, and anomalies.
- Cost explorer path uses upload-aware scope resolver (ingestion-run constrained when raw file IDs are provided).
- Overview and anomaly list endpoints are implemented and query-backed.

#### Static but Mounted Sections

- `/dashboard/resources`, `/dashboard/allocation`, `/dashboard/report` return static summary payloads (implemented response stubs, not warehouse-backed).

### 2.6 Anomaly Detection and Lifecycle

- Detection run model (`AnomalyDetectionRun`) tracks trigger type, mode, scope, counters, and status transitions.
- Ingestion-triggered and manual-triggered runs are supported.
- Implemented detector: daily total cost spike against rolling 7-day median with explicit guardrails.
- Lifecycle logic:
  - upsert anomaly rows by deterministic fingerprint
  - preserve/reopen/ignore semantics by prior status
  - auto-resolve previously open anomalies not re-detected in evaluated window

### 2.7 Optimization Recommendation Sync and Actions

- Sync source connectors implemented for AWS:
  - Compute Optimizer (rightsizing)
  - Cost Explorer Savings Plans recommendations (commitment)
  - Idle detection derived from EC2 + CloudWatch + ELBv2 inventory/traffic checks
- Pipeline stages: fetch -> normalize -> enrich with dim/cost context -> replace open recommendations.
- Freshness-aware sync methods skip remote fetch when recent data exists.
- Background schedulers for rightsizing, idle, and commitment sweep active AWS billing sources.
- Action processors claim queued actions with DB locking (`FOR UPDATE SKIP LOCKED`) and execute AWS operations.

### 2.8 Support and Communication

- Support tickets:
  - client create/list/detail/message/action
  - admin list/detail/update/status/message/delete
- Support meetings:
  - client create/list/cancel
  - admin list/approve/reject/status update/delete
- Announcements:
  - admin CRUD/lifecycle (draft/publish/unpublish/archive)
  - client feed filtered by audience and active publish window

### 2.9 Validation Logic (Implemented)

#### AWS Connection Validation

- `validateAwsConnectionConfig` performs:
  - required field checks (`billingRoleArn`, `externalId`, `expectedAccountId`)
  - backend credential completeness checks
  - STS AssumeRole and caller identity account verification
  - EC2 `DescribeRegions` probe
  - optional S3 prefix list probe for export bucket/prefix
- Validation outcomes: `active`, `active_with_warnings`, `failed`.

#### Manual Setup Validation

- Manual setup schema enforces conditional requirements:
  - export name/ARN requirement
  - action role ARN requirement when action role enabled
  - CloudTrail fields required when CloudTrail enabled
- Complete setup performs pre-validation on billing export path and optional cloudtrail path before persistence.

#### S3 Session Validation

- Role ARN and bucket/prefix input validation via zod + regex/pattern checks.
- Session-scoped key access control blocks out-of-scope object selections.
- Per-object HEAD checks ensure selected keys are accessible before import.

#### Ingestion Validation

- Schema/header canonicalization with alias matching and ambiguity tracking.
- Required-column validation before full processing.
- Numeric sanitization for fixed precision fields with overflow detection.
- Row-level error persistence and reason classification for failed transformations/inserts.

## 3. Database Design (High-Level)

### 3.1 Identity and Access

- `tenants`: tenant partition boundary.
- `users`: tenant users and role/status.
- `auth_sessions`, `admin_auth_sessions`: hashed session tokens.
- `password_reset_tokens`: reset-token lifecycle.
- `admin_users`: admin identities.

### 3.2 Demo Scheduling

- `demo_requests`: request record and status lifecycle.
- `slot_reservations`: slot hold details linked to demo request.

### 3.3 Cloud Connectivity and Registry

- `cloud_provider`: provider master (AWS, etc.).
- `cloud_connection_v2`: automatic cloud connection state and AWS setup fields.
- `manual_cloud_connections`: manual AWS setup detail record.
- `cloud_integrations`: normalized integration registry for UI/ops status.
- `client_cloud_accounts`: per-account tracking metadata (sync status, timestamps).
- `s3_upload_connections`: tenant-saved S3 import connection definitions.

### 3.4 Billing Ingestion Lineage

- `billing_sources`: configured ingestion source (manual upload, S3 temporary, AWS export).
- `raw_billing_files`: source/raw file metadata and storage pointers.
- `billing_ingestion_runs`: run lifecycle, progress, counters.
- `billing_ingestion_run_files`: manifest/data file links per run.
- `billing_ingestion_row_error`: row-level ingest failures.

### 3.5 Cost Warehouse (Dimensions/Facts/Aggregates)

- Dimensions: `dim_billing_account`, `dim_sub_account`, `dim_region`, `dim_service`, `dim_resource`, `dim_sku`, `dim_charge`, `dim_date`.
- Fact: `fact_cost_line_items` (primary normalized cost fact table).
- Aggregates: `agg_cost_hourly`, `agg_cost_daily`, `agg_cost_monthly`.

### 3.6 Analytics and Optimization

- `fact_anomalies`, `anomaly_contributors`, `anomaly_detection_runs`.
- `fact_recommendations` and `fact_recommendation_actions` (action queue/status table used by optimization services).
- `fact_cost_allocations`, `fact_commitment_coverage`.
- `resource_inventory_snapshots`, `resource_utilization_daily`.
- Budgets: `budgets`, `budget_evaluations`, `budget_alerts`.

### 3.7 CloudTrail Event Ingestion

- `cloudtrail_sources`: CloudTrail data-source registration per connection.
- `cloud_events`: both marker events (pending file events) and mapped CloudTrail records.

### 3.8 Support and Announcements

- `support_tickets`, `support_ticket_messages`, `support_meetings`, `announcements`.

## 4. API Layer

### 4.1 Authentication and User Access

| Method | Path | Responsibility |
|---|---|---|
| POST | `/auth/login` | User login and session issuance |
| GET | `/auth/me` | Current authenticated user context |
| POST | `/auth/forgot-password` | Password reset token flow (non-enumerating response) |
| POST | `/auth/reset-password` | Password update + token consume + session revocation |
| GET | `/organization/users` | List users in tenant organization |
| POST | `/organization/users/invite` | Invite user to organization |
| PATCH | `/organization/users/:userId/approve` | Approve pending/invited user |
| PATCH | `/organization/users/:userId/status` | Activate/deactivate user with safeguards |

### 4.2 Admin Authentication

| Method | Path | Responsibility |
|---|---|---|
| POST | `/admin/auth/login` | Admin login |
| GET | `/admin/auth/me` | Current admin session context |

### 4.3 Demo Scheduling

| Method | Path | Responsibility |
|---|---|---|
| GET | `/schedule-demo/slots` | Fetch available demo slots |
| GET | `/schedule-demo/slots/:date` | Fetch slots for a specific date |
| POST | `/schedule-demo` | Submit demo request and reserve slot |

### 4.4 Admin Demo Requests

| Method | Path | Responsibility |
|---|---|---|
| GET | `/admin/demo-requests` | List demo requests |
| GET | `/admin/demo-requests/:id` | Demo request detail |
| PATCH | `/admin/demo-requests/:id/confirm` | Confirm and book demo |
| PATCH | `/admin/demo-requests/:id/reject` | Reject demo request |

### 4.5 Cloud Connections (AWS)

| Method | Path | Responsibility |
|---|---|---|
| POST | `/cloud-connections` | Create draft automatic cloud connection |
| GET | `/cloud-connections/:id` | Fetch cloud connection detail |
| GET | `/cloud-integrations` | List cloud integrations |
| GET | `/cloud-integrations/:id/dashboard-scope` | Integration-linked dashboard scope metadata |
| GET | `/cloud-connections/:id/aws-cloudformation-url` | Build CloudFormation setup URL |
| POST | `/cloud-connections/:id/aws-cloudformation-url` | Build CloudFormation setup URL (POST variant) |
| POST | `/cloud-connections/:id/validate` | Trigger explicit validation |
| POST | `/api/aws/callback` | CloudFormation callback receiver |
| POST | `/api/aws/manual/create-connection` | Manual connection create + validation |
| POST | `/api/aws/manual/browse-bucket` | Manual setup bucket browse |
| POST | `/api/aws/manual/complete-setup` | Persist validated manual setup |
| GET | `/api/aws/ec2/instances` | List EC2 instances for connected account |
| POST | `/api/aws/ec2/start` | Start EC2 instance |
| POST | `/api/aws/ec2/stop` | Stop EC2 instance |
| POST | `/api/aws/ec2/reboot` | Reboot EC2 instance |
| POST | `/api/aws/ec2/change-instance-type` | Change EC2 instance type |
| POST | `/api/aws/export-file-arrived` | AWS export/CloudTrail event callback |

### 4.6 Billing Upload and Ingestion

| Method | Path | Responsibility |
|---|---|---|
| GET | `/billing/cloud-providers` | List available cloud providers |
| GET | `/billing/uploads/history` | Upload/ingestion history |
| POST | `/billing/ingestion/upload` | Manual billing file upload |
| GET | `/billing/ingestions/latest-active` | Latest active ingestion run |
| GET | `/billing/ingestions/:id/status` | Ingestion run status |
| GET | `/billing/sources/:sourceId/latest-ingestion` | Latest run for source |
| POST | `/billing/uploads/s3/session` | Create temporary S3 import session |
| GET | `/billing/uploads/s3/session/:sessionId/list` | List scoped objects for session |
| POST | `/billing/uploads/s3/session/:sessionId/import` | Import selected S3 files |
| POST | `/billing/uploads/s3/connections` | Save persistent S3 connection |
| GET | `/billing/uploads/s3/connections` | List persistent S3 connections |
| POST | `/billing/uploads/s3/connections/:connectionId/session` | Spawn session from saved connection |

### 4.7 Dashboard (Main)

| Method | Path | Responsibility |
|---|---|---|
| GET | `/dashboard/scope` | Resolve effective dashboard scope |
| GET | `/dashboard/overview` | Aggregated overview payload |
| GET | `/dashboard/overview/kpis` | KPI-only view |
| GET | `/dashboard/overview/budget-vs-actual-forecast` | Budget/actual/forecast trend |
| GET | `/dashboard/overview/top-services` | Top service spend |
| GET | `/dashboard/overview/top-accounts` | Top account spend |
| GET | `/dashboard/overview/top-regions` | Top region spend |
| GET | `/dashboard/overview/savings-insights` | Savings summary |
| GET | `/dashboard/overview/anomalies` | Overview anomaly list |
| GET | `/dashboard/overview/recommendations` | Overview recommendation list |
| GET | `/dashboard/filters` | Filter option values |
| GET | `/dashboard/cost-explorer` | Cost explorer chart + breakdowns |
| GET | `/dashboard/resources` | Static resources summary |
| GET | `/dashboard/allocation` | Static allocation summary |
| GET | `/dashboard/report` | Static report summary |
| GET | `/dashboard/budget` | Budget dashboard data |
| POST | `/dashboard/budget` | Create budget |
| PATCH | `/dashboard/budget/:budgetId` | Update budget |
| PATCH | `/dashboard/budget/:budgetId/status` | Update budget status |
| GET | `/dashboard/test-total-spend` | Diagnostic total spend response |
| GET | `/dashboard/anomalies-alerts` | Anomaly list endpoint for dashboard |

### 4.8 Anomaly Detection APIs

| Method | Path | Responsibility |
|---|---|---|
| POST | `/anomaly-detection/jobs` | Create manual anomaly run |
| GET | `/anomaly-detection/jobs/:jobId` | Run status |
| GET | `/anomalies` | Tenant anomaly list with filters |

### 4.9 Optimization APIs

| Method | Path | Responsibility |
|---|---|---|
| GET | `/dashboard/optimization` | Optimization summary |
| GET | `/dashboard/optimization/rightsizing/overview` | Rightsizing overview |
| GET | `/dashboard/optimization/rightsizing/recommendations` | Rightsizing recommendations |
| GET | `/dashboard/optimization/rightsizing/recommendations/:recommendationId` | Rightsizing recommendation detail |
| POST | `/dashboard/optimization/rightsizing/recommendations/:recommendationId/execute` | Queue rightsizing action |
| POST | `/dashboard/optimization/rightsizing/recommendations/:recommendationId/ignore` | Ignore rightsizing recommendation |
| GET | `/dashboard/optimization/rightsizing/actions/:actionId` | Rightsizing action status |
| GET | `/dashboard/optimization/idle/overview` | Idle overview |
| GET | `/dashboard/optimization/idle/recommendations` | Idle recommendations |
| GET | `/dashboard/optimization/idle/recommendations/:recommendationId` | Idle recommendation detail |
| POST | `/dashboard/optimization/idle/recommendations/:recommendationId/execute` | Queue idle action |
| POST | `/dashboard/optimization/idle/recommendations/:recommendationId/ignore` | Ignore idle recommendation |
| GET | `/dashboard/optimization/idle/actions/:actionId` | Idle action status |
| GET | `/dashboard/optimization/commitment/overview` | Commitment overview |
| GET | `/dashboard/optimization/commitment/recommendations` | Commitment recommendations |
| GET | `/dashboard/optimization/commitment/recommendations/:recommendationId` | Commitment recommendation detail |
| POST | `/dashboard/optimization/recommendations/sync` | Manual rightsizing sync |
| POST | `/dashboard/optimization/idle/sync` | Manual idle sync |
| POST | `/dashboard/optimization/commitment/sync` | Manual commitment sync |
| GET | `/dashboard/optimization/recommendations/debug-sync` | Sync + debug metadata |

### 4.10 Upload Dashboard APIs

| Method | Path | Responsibility |
|---|---|---|
| GET | `/upload-dashboard/overview` | Upload dashboard overview |
| GET | `/upload-dashboard/overview/kpis` | Upload KPI view |
| GET | `/upload-dashboard/overview/budget-vs-actual-forecast` | Upload budget/actual/forecast |
| GET | `/upload-dashboard/overview/top-services` | Upload top services |
| GET | `/upload-dashboard/overview/top-accounts` | Upload top accounts |
| GET | `/upload-dashboard/overview/top-regions` | Upload top regions |
| GET | `/upload-dashboard/overview/savings-insights` | Upload savings insights |
| GET | `/upload-dashboard/overview/anomalies` | Upload anomalies preview |
| GET | `/upload-dashboard/overview/recommendations` | Upload recommendations preview |
| GET | `/upload-dashboard/overview/filters` | Upload filter options |
| GET | `/upload-dashboard/cost-explorer` | Upload cost explorer |
| GET | `/upload-dashboard/anomalies-alerts` | Upload anomaly list |

### 4.11 Admin Operations

| Method | Path | Responsibility |
|---|---|---|
| GET | `/admin/clients` | Tenant/client operational summary |
| GET | `/admin/billing-uploads` | Billing upload runs list |
| GET | `/admin/billing-uploads/:runId` | Billing upload run detail |
| GET | `/admin/cloud-connections` | Cloud connection list |
| GET | `/admin/cloud-connections/:integrationId` | Cloud connection detail |
| GET | `/admin/announcements` | List announcements |
| POST | `/admin/announcements` | Create announcement |
| PATCH | `/admin/announcements/:id` | Update announcement |
| POST | `/admin/announcements/:id/publish` | Publish announcement |
| POST | `/admin/announcements/:id/unpublish` | Unpublish announcement |
| POST | `/admin/announcements/:id/archive` | Archive announcement |

### 4.12 Client Announcements and Support

| Method | Path | Responsibility |
|---|---|---|
| GET | `/announcements/client` | Client-visible active announcements |
| GET | `/support/tickets/client` | Client ticket list |
| POST | `/support/tickets/client` | Create client ticket |
| GET | `/support/tickets/client/:ticketId` | Client ticket detail |
| GET | `/support/tickets/client/:ticketId/messages` | Client ticket messages |
| POST | `/support/tickets/client/:ticketId/messages` | Post client ticket message |
| PATCH | `/support/tickets/client/:ticketId` | Client ticket action |
| GET | `/admin/support-tickets` | Admin ticket list |
| GET | `/admin/support-tickets/:ticketId` | Admin ticket detail |
| PATCH | `/admin/support-tickets/:ticketId` | Admin ticket update |
| PATCH | `/admin/support-tickets/:ticketId/status` | Admin ticket status update |
| DELETE | `/admin/support-tickets/:ticketId` | Admin ticket delete |
| GET | `/admin/support-tickets/:ticketId/messages` | Admin ticket messages |
| DELETE | `/admin/support-tickets/:ticketId/messages` | Admin message thread clear |
| POST | `/admin/support-tickets/:ticketId/messages` | Admin message post |
| GET | `/support/meetings/client` | Client meeting list |
| POST | `/support/meetings/client` | Create meeting request |
| PATCH | `/support/meetings/client/:meetingId` | Client meeting action |
| GET | `/admin/support-meetings` | Admin meeting list |
| PATCH | `/admin/support-meetings/:meetingId/approve` | Approve meeting |
| PATCH | `/admin/support-meetings/:meetingId/reject` | Reject meeting |
| PATCH | `/admin/support-meetings/:meetingId/status` | Update meeting status |
| DELETE | `/admin/support-meetings/:meetingId` | Delete meeting |

## 5. External Integrations

### AWS

- STS (`AssumeRole`, `GetCallerIdentity`) for role-based delegated access.
- S3 for:
  - raw billing file storage
  - upload-session browsing/validation/import
  - AWS export manifest/parquet ingestion
  - CloudTrail object retrieval
- EC2 for connection probes and runtime instance/idle-resource actions.
- Compute Optimizer for rightsizing recommendations.
- Cost Explorer Savings Plans APIs for commitment recommendations.
- CloudWatch + ELBv2 for idle load balancer traffic checks.

### Scheduling and Email

- Cal.com API for slot discovery, reservation, and booking conversion.
- Mailgun API for transactional email delivery.

### Data Format/Processing Libraries

- CSV parser (`csv-parser`) and Parquet readers (`parquetjs-lite`, `parquet-wasm` fallback paths) used by ingestion services.

## 6. Data Flow

### 6.1 Demo Scheduling Flow

1. Public client fetches slots from Cal.com.
2. Client submits demo request.
3. Backend reserves slot and persists `DemoRequest` + `SlotReservation` + tenant/user linkage.
4. Admin confirms/rejects request.
5. Confirmation path creates Cal.com booking and sends notification email.

### 6.2 Automatic AWS Onboarding Flow

1. Tenant creates draft cloud connection.
2. Backend returns CloudFormation setup URL with callback metadata.
3. AWS stack callback hits `/api/aws/callback`.
4. Backend upserts connection + billing/cloudtrail source records.
5. Post-callback process runs uniqueness check + AWS validation.
6. If valid, initial export backfill is attempted and status is promoted.

### 6.3 Manual AWS Onboarding Flow

1. Client supplies role/bucket metadata for manual create.
2. Backend assumes role, validates account + bucket access, persists seed record.
3. Client completes wizard payload.
4. Backend validates billing export path (and cloudtrail path when enabled).
5. Backend upserts completed manual setup and syncs integration registry.

### 6.4 Billing Ingestion Flow

1. Files enter system via manual upload, S3 import session, or AWS manifest callback.
2. `RawBillingFile` + `BillingIngestionRun` (+ run-file links) are created.
3. Orchestrator validates schema, reads chunks, normalizes rows, upserts dimensions, inserts facts, records row errors.
4. Aggregate tables are refreshed for the run scope.
5. Run status is finalized (`completed`, `completed_with_warnings`, or `failed`).

### 6.5 Post-Ingestion Analytics Flow

1. Successful ingestion completion enqueues anomaly detection run.
2. Detector computes daily cost spike candidates and applies lifecycle updates in `fact_anomalies`.
3. Rightsizing and idle recommendation sync hooks run after ingestion.
4. Dashboard endpoints read from facts/aggregates/anomalies/recommendations.

### 6.6 Recommendation Execution Flow

1. User triggers execute endpoint for rightsizing or idle recommendation.
2. Action row is queued (`fact_recommendation_actions`) with idempotency handling.
3. Background processor claims queued rows with lock-safe polling.
4. AWS action executes (instance resize, EBS delete, EIP release, snapshot delete).
5. Action/recommendation statuses are updated to `SUCCEEDED`/`FAILED` and `APPLIED`/`OPEN`/`FAILED`.

### 6.7 CloudTrail Event Flow

1. AWS file event callback registers CloudTrail object marker in `cloud_events` as pending.
2. Background file processor downloads/parses CloudTrail JSON(.gz), maps records, dedupes by fingerprint.
3. Parsed events are inserted; marker row is marked processed/failed.
