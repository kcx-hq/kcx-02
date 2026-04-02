# Manual AWS Setup - Temporary Validation Harness Summary

## Purpose
This document captures exactly what was implemented for **manual AWS setup** in temporary validation mode. It is intended as the reference for designing the final backend and database model.

Implemented goal:
- Validate real AWS cross-account setup end-to-end from manual UI.
- Keep implementation temporary, isolated, and easy to replace.
- Avoid persistence/schema work until flow is proven.

Not in scope:
- No DB writes for manual setup.
- No manual setup models/migrations.
- No CloudFormation/callback flow for manual mode.

## End-to-End Flow (Current)
1. User completes manual AWS setup form in frontend.
2. User clicks **Test Connection**.
3. Frontend calls `POST /api/aws/manual/test-connection`.
4. Backend validates AWS access:
   - AssumeRole using request `roleArn` + `externalId`
   - GetCallerIdentity
   - optional account match with `expectedAccountId`
   - EC2 DescribeRegions permission health check
5. Frontend shows inline success/failure.
6. If success, frontend reveals **Continue** button.
7. User clicks **Continue**.
8. Frontend opens modal and calls `POST /api/aws/manual/browse-bucket`.
9. Backend:
   - AssumeRole again
   - resolves real S3 bucket region dynamically
   - lists bucket objects/prefixes using region-aware S3 client
10. Frontend modal renders bucket explorer (folders/files, breadcrumb navigation).

## Backend Implementation
Feature path:
- `backend/src/features/cloud-connections/aws/manual-test-connection/`

Files:
- `manual-test-connection.routes.ts`
- `manual-test-connection.controller.ts`
- `manual-test-connection.schema.ts`
- `manual-test-connection.service.ts`

Route mounting:
- `backend/src/features/_app/app.routes.ts`

Routes (auth-protected):
- `POST /api/aws/manual/test-connection`
- `POST /api/aws/manual/browse-bucket`

## Request/Response Contracts
### 1) Test Connection
`POST /api/aws/manual/test-connection`

Request:
- `connectionName` (required)
- `reportName` (required)
- `roleArn` (required)
- `externalId` (required)
- `expectedAccountId` (optional, 12-digit)

Response data:
- `success`
- `assumeRoleSucceeded`
- `callerIdentity { account, userArn }`
- `accountMatch { expected, actual, matched } | null`
- `permissionCheck { checked, succeeded, errorMessage }`
- `errorMessage`

### 2) Browse Bucket
`POST /api/aws/manual/browse-bucket`

Request:
- `roleArn` (required)
- `externalId` (required)
- `bucketName` (required)
- `prefix` (optional)
- `expectedAccountId` (optional, 12-digit)

Response data:
- `success`
- `assumeRoleSucceeded`
- `callerIdentity`
- `accountMatch`
- `bucketName`
- `prefix`
- `items[]`:
  - `key`
  - `name`
  - `type` (`folder` | `file`)
  - `size`
  - `lastModified`
  - `path`
- `errorMessage`

## AWS Credential and AssumeRole Behavior
Credential source order:
1. `AWS_VALIDATION_ACCESS_KEY_ID` + `AWS_VALIDATION_SECRET_ACCESS_KEY`
2. fallback `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`

Rules implemented:
- KCX backend uses its own IAM user creds (env).
- `roleArn` and `externalId` always come from request payload.
- No hardcoded role/account/externalId in service logic.

## S3 PermanentRedirect Fix (Region-Aware Listing)
Issue observed:
- S3 listing failed with `PermanentRedirect` because listing used wrong region.

Fix implemented:
- Resolve actual bucket region before listing using `GetBucketLocation`.
- Normalize region value:
  - `null/empty` -> `us-east-1`
  - `EU` -> `eu-west-1`
- Fallback parse from AWS error headers (`x-amz-bucket-region`) when available.
- Create S3 client with resolved bucket region.
- Run `ListObjectsV2` using region-aware client.

## Frontend Implementation
Primary files:
- `frontend/src/features/client-home/pages/ClientBillingPage.tsx`
- `frontend/src/features/client-home/api/cloud-connections.api.ts`

API methods wired:
- `testAwsManualConnection(...)`
- `browseAwsManualBucket(...)`

UI behavior implemented:
- `Test Connection` runs backend validation.
- Shows inline loading/success/error.
- `Continue` button appears only after validation success.
- `Continue` opens KCX-themed modal explorer.
- Explorer supports:
  - breadcrumb navigation
  - folder click into prefix
  - file/folder table (Name, Type, Last Modified, Size)
  - loading/empty/error states
  - close + reload actions

## Auth/Redirect Behavior
Relevant file:
- `frontend/src/lib/api.ts`

Outcome:
- Manual validation flow no longer redirects to login on generic failures.
- Errors are surfaced in-page/modal.
- Login redirect should happen only for real auth invalidation scenarios.

## Logging and Debugging
Backend logs include (safe, no secrets):
- request received
- credential source selected
- AssumeRole start/success/failure
- GetCallerIdentity account ID
- bucket region resolution start/result/failure
- final region used for listing
- listing success/failure

## Temporary Boundaries Preserved
- No DB persistence for manual setup.
- No new tables/models for manual flow.
- No schema/migration changes required for this harness.
- No unrelated auth or architecture refactors.
- Implementation kept modular enough to reuse logic in final backend.

## Data Points Collected (Useful for Final DB Design)
User-supplied:
- `connectionName`
- `reportName`
- `bucketName`
- `prefix`
- `roleArn`
- `externalId`
- `expectedAccountId` (optional)

Runtime-derived:
- assumed account ID (`callerIdentity.account`)
- account match result
- permission check result
- resolved bucket region
- bucket object/prefix listing response

## Current Status
- Temporary manual validation harness is functional.
- Cross-account validation works.
- Post-success bucket browse works with dynamic region resolution.
- Build checks passed after implementation.
