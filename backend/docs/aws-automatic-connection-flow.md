# AWS Automatic Connection Flow (Backend)

This document explains the current automatic AWS cloud-connection backend flow, focused on:
- authentication and authorization
- callback handling
- cross-account role validation

CloudFormation template internals are intentionally excluded.

For CloudFormation module wiring and deployment commands, see:
- `backend/docs/aws-action-role-modules.md`

## Routes

Source: `backend/src/features/cloud-connections/aws/auto-connection/cloud-connections.routes.ts`

- `POST /cloud-connections` (auth required)
- `GET /cloud-connections/:id` (auth required)
- `GET /cloud-connections/:id/aws-cloudformation-url` (auth required)
- `POST /cloud-connections/:id/validate` (auth required)
- `POST /api/aws/callback` (no session auth; callback-token based)

## Auth Model

- Session-protected endpoints use `requireAuth`.
- Tenant-scoped operations use `req.auth.user.tenantId`.
- Callback endpoint is authorized by `callback_token` in body, not by user session.

## End-to-End Flow

1. Create connection (`POST /cloud-connections`)
- Validates payload (`connection_name`, provider, account type).
- Checks for same `connection_name` in the same tenant.
- Creates/fetches provider entry in `cloud_providers`.
- Creates a `cloud_connections` row with:
  - `status = draft`
  - generated `external_id`
  - generated `callback_token`
  - generated `stack_name`
  - `region = us-east-1`

2. Generate setup URL (`GET /cloud-connections/:id/aws-cloudformation-url`)
- Ensures setup fields exist (`stack_name`, `external_id`, `callback_token`, `region`).
- Returns AWS setup URL with callback token + external ID.
- Moves status `draft -> connecting`.

3. Process callback (`POST /api/aws/callback`)
- Finds connection by `callback_token`.
- Stores:
  - `cloud_account_id`
  - `role_arn`
  - `stack_id`
  - `status = awaiting_validation`
  - `connected_at = now`
- Triggers immediate validation.

4. Validate on demand (`POST /cloud-connections/:id/validate`)
- Runs same validation pipeline manually.

## Cross-Account Validation Pipeline

Source: `backend/src/features/cloud-connections/aws/auto-connection/aws-connection-validation.service.ts`

1. Load connection by ID.
2. Require `role_arn`, `external_id`, `cloud_account_id`.
3. Build STS client using backend AWS validation credentials:
   - `AWS_VALIDATION_ACCESS_KEY_ID` / `AWS_VALIDATION_SECRET_ACCESS_KEY`
   - fallback: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
4. Call `AssumeRole` with:
   - role ARN from connection
   - external ID from connection
   - generated role session name
5. With assumed creds, call `GetCallerIdentity` and compare account ID with stored `cloud_account_id`.
6. With assumed creds, call `EC2 DescribeRegions` as a permission health check.

## Validation Outcomes

- `active`: AssumeRole + account match + DescribeRegions passed.
- `active_with_warnings`: AssumeRole + account match passed, but DescribeRegions failed.
- `failed`: missing fields, credentials issues, AssumeRole/account mismatch failures, or other hard errors.

## Key Fields in `cloud_connections`

- Identity/setup: `external_id`, `callback_token`, `stack_name`, `stack_id`
- AWS trust/account: `role_arn`, `cloud_account_id`, `payer_account_id`
- Lifecycle: `status`, `connected_at`, `last_validated_at`, `error_message`
- Ownership/scope: `tenant_id`, `provider_id`, `created_by`, `connection_name`, `account_type`, `region`

## Relevant Files

- `backend/src/features/cloud-connections/aws/auto-connection/cloud-connections.routes.ts`
- `backend/src/features/cloud-connections/aws/auto-connection/cloud-connections.controller.ts`
- `backend/src/features/cloud-connections/aws/auto-connection/aws-connection-validation.service.ts`
- `backend/src/features/cloud-connections/aws/auto-connection/cloud-connections.schema.ts`
- `backend/src/models/cloud-connection-v2.ts`
- `backend/src/middlewares/auth.middleware.ts`
- `backend/src/config/env.ts`
