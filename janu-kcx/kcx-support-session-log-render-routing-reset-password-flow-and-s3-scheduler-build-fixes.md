# KCX Support Session Log: Render Routing, Reset Password Flow, and S3 Scheduler/Build Fixes

> Index No: 18

## Scope
This document captures the full support session covering:
- Reset password route returning `Not Found` on Render.
- Auth-page links not navigating.
- Reset email link opening broken URL.
- S3 scheduler warnings (`AWS provider not found`).
- Backend TypeScript build errors in S3 optimization module.

## 1. Initial Production Issue
### Reported symptom
On production (`kcxhq.com`), clicking **Reset password** led to:
- URL like `/forgot-password` or `/reset-password?...`
- page response: `Not Found`

### Root cause identified
The route exists in frontend code, but server/domain routing returned 404 before SPA boot.
This indicated a Render/domain rewrite or service-mapping issue, not missing React page code.

## 2. First Frontend Navigation Fix Attempt
### Change made
Auth links were changed from plain anchors to router links:
- `frontend/src/features/landing/pages/auth/components/LoginForm.tsx`
- `frontend/src/features/landing/pages/auth/components/ForgotPasswordForm.tsx`
- `frontend/src/features/landing/pages/auth/components/ResetPasswordForm.tsx`

### Result
Links still appeared non-working due to project architecture.

## 3. Correct Frontend Navigation Fix
### Discovery
This app uses custom navigation (`navigateTo` + `handleAppLinkClick`) rather than React Router state for page rendering.

### Corrected change
Replaced auth links to use existing app link handler pattern:
- `handleAppLinkClick(event, "/forgot-password")`
- `handleAppLinkClick(event, "/schedule-demo")`
- `handleAppLinkClick(event, "/login")`

Files updated:
- `frontend/src/features/landing/pages/auth/components/LoginForm.tsx`
- `frontend/src/features/landing/pages/auth/components/ForgotPasswordForm.tsx`
- `frontend/src/features/landing/pages/auth/components/ResetPasswordForm.tsx`

## 4. Reset Email Link Reliability Hardening
### Observation
Backend already generated reset links using `buildFrontendUrl("/reset-password", { token })` and env `FRONTEND_BASE_URL`.

### Hardening change
Sanitized optional env values to strip accidental surrounding quotes:
- File: `backend/src/config/env.ts`
- `optionalEnv()` now removes leading/trailing `'` or `"`.

## 5. S3 Scheduler Warning Fix
### Reported logs
- `S3 bucket config scheduler skipped: AWS provider not found`
- `Storage Lens scheduler skipped: AWS provider not found`

### Root cause
Missing `aws` row in `cloud_providers` table.

### Fix implemented
Made both schedulers self-healing with `findOrCreate`:
- `backend/src/features/billing/services/s3-bucket-config-snapshot-scheduler.service.ts`
- `backend/src/features/billing/services/s3-storage-lens-scheduler.service.ts`

Behavior now:
- Auto-creates provider `{ code: "aws", name: "Amazon Web Services", status: "active" }` if absent.
- Logs one-time auto-create info and proceeds.

## 6. Backend Build Errors in S3 Optimization
### Reported errors
`getReplicationVisibilityRows` missing and downstream unknown/implicit-any typing failures.

### Fix implemented
Added full typed repository method and mapping logic:
- File: `backend/src/features/dashboard/s3/s3-optimization.repository.ts`
- Added `getReplicationVisibilityRows(scope)` returning `S3BucketReplicationRow[]`.
- Added replication DB row type and parsing for status/rules/destination bucket/region/type.

### Verification
`backend` build succeeded after fix (`tsc -p tsconfig.json`).

## 7. Code-Level Fallback for Broken Deep-Link Rewrites
### Persistent production symptom
Direct email link to `/reset-password?token=...` still returned `Not Found` when infra rewrite/domain mapping was wrong.

### Implemented fallback
#### Backend change
Reset links now point to root with action query:
- File: `backend/src/features/auth/auth.service.ts`
- from: `/reset-password?token=...`
- to: `/?action=reset-password&token=...`

#### Frontend change
On `/`, app auto-forwards internally to reset page when query has action token:
- File: `frontend/src/App.tsx`
- Reads query params: `action=reset-password` and `token`
- Replaces URL with `/reset-password?token=...` and dispatches `popstate`

This avoids server deep-link 404 as long as root URL loads.

## 8. Deployment Notes Provided
Recommended Render settings repeatedly confirmed:
1. Static site rewrite rule: `/* -> /index.html` (Rewrite).
2. Custom domain `kcxhq.com` should point to frontend static service.
3. Backend should use separate API host when possible (e.g., `api.kcxhq.com`).
4. Backend env: `FRONTEND_BASE_URL=https://kcxhq.com` (no quotes).
5. Redeploy frontend + backend and test with a newly generated reset email.

## 9. Build/Verification Notes
- Backend build passed after repository + scheduler fixes.
- Frontend local build in this environment failed due to local Tailwind/Vite native module (`EPERM` / oxide binary load), treated as environment-specific rather than app logic regression.

## Files Changed Across Session
- `frontend/src/features/landing/pages/auth/components/LoginForm.tsx`
- `frontend/src/features/landing/pages/auth/components/ForgotPasswordForm.tsx`
- `frontend/src/features/landing/pages/auth/components/ResetPasswordForm.tsx`
- `frontend/src/App.tsx`
- `backend/src/config/env.ts`
- `backend/src/features/auth/auth.service.ts`
- `backend/src/features/billing/services/s3-bucket-config-snapshot-scheduler.service.ts`
- `backend/src/features/billing/services/s3-storage-lens-scheduler.service.ts`
- `backend/src/features/dashboard/s3/s3-optimization.repository.ts`

## Final Outcome
Core code issues were resolved and hardened. Remaining production behavior depends on Render domain/rewrite configuration plus redeployment using the updated code.
