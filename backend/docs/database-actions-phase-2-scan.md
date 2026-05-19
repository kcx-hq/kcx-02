# Database Actions Phase 2 Scan

## Scope and intent
This is a scan-only report of current backend action/execution infrastructure, with focus on EC2 recommendation actions and what Database recommendation actions should reuse vs implement separately.

## 1) Existing action infrastructure

### 1.1 Entry points (HTTP contracts)
- Dashboard optimization execution endpoints (new action infrastructure):
  - `POST /dashboard/optimization/rightsizing/recommendations/:recommendationId/execute`
  - `GET /dashboard/optimization/rightsizing/actions/:actionId`
  - `POST /dashboard/optimization/idle/recommendations/:recommendationId/execute`
  - `GET /dashboard/optimization/idle/actions/:actionId`
  - `POST /dashboard/optimization/*/recommendations/:recommendationId/ignore`
- Route/controller/service chain:
  - `backend/src/features/dashboard/dashboard.routes.ts`
  - `backend/src/features/dashboard/optimization/optimization.controller.ts`
  - `backend/src/features/dashboard/optimization/optimization.service.ts`

### 1.2 Action persistence model (runtime SQL contract)
- Actions are persisted in SQL table `fact_recommendation_actions` (read/write via raw SQL in services).
- Recommendation lifecycle state is persisted in `fact_recommendations.status` and related fields.
- Action status machine used in code:
  - Action row: `QUEUED -> RUNNING -> SUCCEEDED | FAILED`
  - Recommendation row during execution: `OPEN -> IN_PROGRESS -> APPLIED | FAILED` (or back to `OPEN` for dry run)

### 1.3 Worker/queue pattern
- Queue is DB-backed (`fact_recommendation_actions`) with claim loop:
  - claim next via `FOR UPDATE SKIP LOCKED`
  - mark `RUNNING`
  - execute action
  - mark success/failure and update parent recommendation status
- Implemented in:
  - `backend/src/features/dashboard/optimization/recommendation-sync/rightsizing-actions.service.ts`
  - `backend/src/features/dashboard/optimization/recommendation-sync/idle-actions.service.ts`

### 1.4 Background processors
- Timer-based processors exist:
  - `startRightsizingActionProcessor()`
  - `startIdleActionProcessor()`
- Files:
  - `backend/src/features/dashboard/optimization/recommendation-sync/rightsizing-action-processor.service.ts`
  - `backend/src/features/dashboard/optimization/recommendation-sync/idle-action-processor.service.ts`
- Important runtime finding:
  - In `backend/server.ts`, processor startup lines are currently commented out.
  - Immediate processing is still triggered inline after execute API call, but no always-on background drain loop is running from server bootstrap.

## 2) Generic/reusable parts

### 2.1 Generic request/response execution contract
- `execute` returns `{ actionId, recommendationId, status }`.
- `action status` endpoint returns timeline + error details + dry run + request details.
- Frontend already has typed contracts for this (`dashboardTypes.ts`).

### 2.2 Generic control-plane checks
Reusable guard sequence in action services:
- recommendation exists for tenant
- recommendation status is actionable
- required execution fields present
- no active action already `QUEUED/RUNNING`
- optional idempotency-key replay
- enqueue row into action table

### 2.3 Generic queue processing algorithm
Reusable pattern:
- claim oldest queued action with `SKIP LOCKED`
- set action to `RUNNING` + timestamp
- set recommendation `IN_PROGRESS`
- call resource-specific executor
- on success/fail update action row and recommendation status atomically

### 2.4 Generic dry-run behavior
- `dryRun=true` still creates/executes action row.
- Resource mutation is skipped.
- Action becomes `SUCCEEDED`.
- Recommendation status reverts from `IN_PROGRESS` to `OPEN`.

### 2.5 Generic idempotency handling
- Optional `idempotencyKey` accepted at API layer.
- If same `tenant + recommendation + idempotency_key` exists, existing action is returned instead of new insert.

### 2.6 Generic tenancy/auth gating
- Endpoints are under `requireAuth`.
- Tenant is resolved from `req.auth.user.tenantId`.
- SQL queries are consistently tenant-scoped (`tenant_id = $1`).

## 3) EC2-specific parts

### 3.1 Resource mutator implementation
- Rightsizing execution calls `changeInstanceType(...)`.
- Idle execution calls `deleteVolume(...)`, `releaseAddress(...)`, `deleteSnapshot(...)` by recommendation type.
- EC2-specific code is in:
  - `backend/src/features/cloud-connections/aws/ec2/ec2.shared.service.ts`

### 3.2 AWS validation and constraints
EC2 logic includes service-specific safeguards:
- instance state checks (running/stopped eligibility)
- ASG-managed instance block
- target type format checks
- EBS/EIP/snapshot ownership/attachment eligibility checks

### 3.3 Recommendation-type-to-action-type mapping
- Idle action types are hard-coded for EC2 resources:
  - `APPLY_IDLE_DELETE_EBS`
  - `APPLY_IDLE_RELEASE_EIP`
  - `APPLY_IDLE_DELETE_SNAPSHOT`
- Rightsizing action type is hard-coded:
  - `APPLY_RIGHTSIZING`

## 4) What DB module should reuse

1. Execution API shape and response model
2. `fact_recommendation_actions` queue-backed lifecycle model
3. Claim/execute/finalize worker pattern with `SKIP LOCKED`
4. Dry-run semantics
5. Idempotency-key semantics
6. Tenant-scoped authorization pattern (`requireAuth` + tenant-bound SQL)
7. Recommendation conflict handling semantics (block if already in active run / non-actionable state)

## 5) What DB module should implement separately

1. DB-specific action types and mapping from DB recommendation types to action type.
2. DB-specific AWS executor(s) (e.g., RDS/Aurora API operations), including eligibility checks.
3. DB-specific validation of resource fields required for execution.
4. DB-specific error normalization codes (parallel to `AwsEc2Error` pattern).
5. DB-specific “non-actionable” rules (some recommendations may be advisory-only).
6. DB-specific status transitions if different from EC2 (if keeping same states, still implement independently).

## 6) Files involved

### Core action infra (generic candidate)
- `backend/src/features/dashboard/dashboard.routes.ts`
- `backend/src/features/dashboard/optimization/optimization.controller.ts`
- `backend/src/features/dashboard/optimization/optimization.service.ts`
- `backend/src/features/dashboard/optimization/recommendation-sync/rightsizing-actions.service.ts`
- `backend/src/features/dashboard/optimization/recommendation-sync/idle-actions.service.ts`
- `backend/src/features/dashboard/optimization/recommendation-sync/rightsizing-action-processor.service.ts`
- `backend/src/features/dashboard/optimization/recommendation-sync/idle-action-processor.service.ts`
- `backend/src/middlewares/auth.middleware.ts`
- `backend/src/features/dashboard/shared/dashboard-request-builder.ts`

### EC2-specific execution and recommendation modules
- `backend/src/features/cloud-connections/aws/ec2/ec2.shared.service.ts`
- `backend/src/features/ec2/optimization/ec2-optimization.routes.ts`
- `backend/src/features/ec2/optimization/ec2-recommendations.controller.ts`
- `backend/src/features/ec2/optimization/ec2-recommendations.service.ts`
- `backend/src/features/ec2/optimization/ec2-recommendations.repository.ts`

### DB recommendations (current state)
- `backend/src/features/database/database.routes.ts`
- `backend/src/features/database/recommendations/db-recommendations.routes.ts`
- `backend/src/features/database/recommendations/db-recommendations.controller.ts`
- `backend/src/features/database/recommendations/db-recommendations.service.ts`
- `backend/src/features/database/recommendations/db-recommendations.generator.ts`

### Frontend/backend contracts
- `frontend/src/features/dashboard/api/dashboardApi.ts`
- `frontend/src/features/dashboard/api/dashboardTypes.ts`

### Schema/models/migrations observed
- `backend/src/models/billing/fact_recommendations.ts`
- `backend/src/migrations/20260505163000-add-ec2-recommendation-lifecycle-fields.ts`
- `backend/src/migrations/20260512123000-create-complete-schema-single-migration-v2.ts`
- `backend/server.ts`

## 7) Risks when adding DB actions

1. **Action table schema ownership gap**
- `fact_recommendation_actions` is heavily used by code, but explicit model/migration for it was not found in scanned backend migrations/models.
- Risk: environment drift or missing table/columns across deployments.

2. **Processor bootstrap is disabled in server startup**
- In `backend/server.ts`, action processors/schedulers for optimization are commented out.
- Risk: queued actions may only run when execute endpoints trigger immediate processor invocation; backlog resilience is weaker.

3. **No dedicated DB action contracts yet**
- Database module currently supports list/detail/summary/generate only; no execute/status/ignore endpoints.
- Risk: frontend/backend contract divergence if DB actions are introduced inconsistently.

4. **Audit/event trail inconsistency**
- `recommendation_status_events` table exists, but scanned action flows update statuses directly without writing event rows.
- Risk: incomplete audit trail for executed DB actions unless explicitly added.

5. **Concurrency edge cases**
- Active action checks rely on status filtering and transaction timing.
- Risk: if DB action types are added without consistent filtering, duplicate concurrent executions may slip in.

6. **Status taxonomy mismatch across modules**
- Existing EC2 recommendations API uses lowercase domain statuses (`open`, `snoozed`, etc.) while optimization action flow uses uppercase lifecycle statuses (`OPEN`, `APPLIED`, etc.).
- Risk: DB actions may inherit mixed semantics unless normalized at module boundary.

7. **Credential resolution coupling**
- EC2 execution relies on `CloudConnectionV2` + action role ARN + external ID + region + STS assume role.
- Risk: DB actions using different service/region/account assumptions need explicit resolution rules, not implicit EC2 reuse.

## Direct answers to requested focus

1. **What action infrastructure already exists?**
- DB-backed action queue + execute/status endpoints + worker loop + dry-run/idempotency + recommendation lifecycle updates.

2. **Which parts are generic and reusable?**
- Execution contract, queue lifecycle, tenancy checks, idempotency, dry-run flow, status polling shape.

3. **Which parts are EC2-specific?**
- AWS EC2 mutator operations, eligibility rules, action type constants, recommendation-type mapping to EC2 APIs.

4. **What DB module should reuse?**
- Generic queue/action orchestration and API/status contract.

5. **What DB module should implement separately?**
- DB recommendation-to-action mapping, DB mutators, DB eligibility, DB error taxonomy.

6. **What files are involved?**
- See Section 6.

7. **What risks exist if DB actions are added?**
- See Section 7, especially action table schema ownership and disabled processors.
