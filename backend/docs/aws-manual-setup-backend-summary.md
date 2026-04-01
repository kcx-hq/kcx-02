# AWS Manual Setup Backend Summary

## 1. Overview
- AWS Manual Setup is KCX's guided onboarding flow for creating an AWS billing connection.
- The backend persists connection metadata, tracks setup progress, and (planned) validates AWS access before activation.
- Current scope in backend:
  - Step 1 persistence is implemented end-to-end.
  - Step 2, Step 3, and AWS runtime validation are pending.

## 2. Flow Summary (End-to-End)
- **Step 1 - Prepare Billing Data:** client provides billing export S3 bucket and optional prefix; backend creates/updates a DRAFT AWS connection.
- **Step 2 - Configure Cross-Account Access:** client provides IAM role/policy resource names and external-id context; backend persistence is planned.
- **Step 3 - Confirm Connection Details:** client provides connection metadata + role ARN + export name; backend persistence is planned.
- **Finalization:** connection transitions from DRAFT to ACTIVE after required inputs are complete (planned).
- **Validation:** backend verifies AssumeRole + S3 access before activation (planned).

## 3. Database Design
### 3.1 CloudConnections (Parent)
- **Purpose:** provider-agnostic connection record and lifecycle state.
- **Key fields:**
  - `id` (UUID PK)
  - `clientId` (owner user/client)
  - `provider` (`aws`)
  - `connectionName`
  - `setupMode` (`manual`)
  - `status` (`DRAFT` -> `ACTIVE` planned)
  - `currentStep` (wizard progress)
  - `isActive`, `lastValidatedAt`, `lastSyncAt`, `lastSuccessAt`, `lastError`

### 3.2 AwsCloudConnections (Child)
- **Purpose:** AWS-specific connection details for one parent cloud connection.
- **Key fields:**
  - `id` (UUID PK)
  - `cloudConnectionId` (unique FK to `CloudConnections.id`)
  - `awsAccountId` (nullable)
  - `bucketName`
  - `bucketPrefix` (nullable)
  - `setupMethod` (`manual`)
  - `roleArn` (nullable)
  - `externalId` (nullable)
  - `reportName` (nullable)

### 3.3 Relationship
- **1:1 mapping:** `CloudConnections.hasOne(AwsCloudConnection)` via `cloudConnectionId`.
- **Lifecycle ownership:** parent row tracks workflow state; child row stores AWS-specific inputs for that same lifecycle.

## 4. Step-wise Backend Flow
### Step 1 (Implemented)
- **Frontend trigger:** Step 1 inputs become valid in manual flow; frontend posts payload.
- **API endpoint:** `POST /api/cloud-connections/aws/manual/step-1` (auth required).
- **Validation:**
  - `bucketName`: required, trimmed.
  - `bucketPrefix`: optional, trimmed, trailing slash removed, normalized to `null` when empty.
- **DB operations (single transaction):**
  - Find latest DRAFT AWS `CloudConnection` for `clientId`; create if missing.
  - Set/keep `currentStep = 2`.
  - Upsert `AwsCloudConnection` with `bucketName`, `bucketPrefix`, `setupMethod = manual`.
- **Response:** `{ connectionId, nextStep: 2 }`.

### Step 2 (Planned)
- **What will be persisted:**
  - IAM role name (tracking field)
  - custom policy name (tracking field)
  - external-id linkage (if generated/managed server-side)
- **Expected API contract:** step-specific POST to save Step 2 data for current DRAFT connection.
- **DB updates:** update AWS child record and advance parent `currentStep` to `3`.

### Step 3 (Planned)
- **What will be persisted:**
  - `roleArn`
  - `reportName` (Data Export Name)
  - final `connectionName` on parent
- **`roleArn` importance:** required for AssumeRole validation and ongoing secure access checks.
- **Final input stage:** marks setup ready for validation and activation transition.

## 5. API Endpoints
### Implemented
```http
POST /api/cloud-connections/aws/manual/step-1
```
- **Purpose:** create/update Step 1 data and open/advance DRAFT connection.
- **Request (short):**
```json
{
  "bucketName": "company-billing-export",
  "bucketPrefix": "optional/prefix"
}
```
- **Response (short):**
```json
{
  "connectionId": "uuid",
  "nextStep": 2
}
```

### Planned
```http
POST /api/cloud-connections/aws/manual/step-2
```
- **Purpose:** persist Step 2 IAM resource metadata.
- **Request (short):**
```json
{
  "roleName": "KCXBillingReadRole",
  "customPolicyName": "KCXBillingBucketReadPolicy",
  "externalId": "optional-or-server-managed"
}
```
- **Response (short):**
```json
{
  "connectionId": "uuid",
  "nextStep": 3
}
```

```http
POST /api/cloud-connections/aws/manual/step-3
# or
POST /api/cloud-connections/aws/manual/complete
```
- **Purpose:** persist final details and trigger validation/finalization path.
- **Request (short):**
```json
{
  "connectionName": "Finance Prod AWS",
  "reportName": "billing-export-prod",
  "roleArn": "arn:aws:iam::123456789012:role/KCXBillingReadRole"
}
```
- **Response (short):**
```json
{
  "connectionId": "uuid",
  "status": "DRAFT|ACTIVE",
  "validation": "pending|passed|failed"
}
```

## 6. State Management
- Parent `status` lifecycle target:
  - `DRAFT` during setup.
  - `ACTIVE` after successful completion + validation (planned).
- `currentStep` progression target:
  - `1 -> 2 -> 3` as each step is persisted.
- Draft overwrite behavior (current Step 1 behavior):
  - Backend reuses existing DRAFT AWS connection for `(clientId, provider=aws)`.
  - Step 1 re-submissions update same DRAFT data instead of creating duplicates.
  - DB has partial unique index for one DRAFT per client+provider.

## 7. AWS Validation (Planned)
- AssumeRole via STS using:
  - `roleArn`
  - `externalId`
- Validate S3 read access against:
  - `bucketName`
  - optional `bucketPrefix`
- Handling:
  - **Success:** set `status=ACTIVE`, update `isActive`, set validation timestamps.
  - **Failure:** keep `DRAFT`, capture `lastError`, return actionable validation result.

## 8. Current Implementation Status
- ✅ **Implemented**
  - Step 1 full flow:
    - frontend submit
    - backend auth + validation
    - transactional upsert into `CloudConnections` + `AwsCloudConnections`
    - success response with `connectionId` and `nextStep`

- 🚧 **Pending**
  - Step 2 backend API + persistence
  - Step 3 backend API + persistence/finalization
  - AWS validation pipeline (STS + S3 checks)
