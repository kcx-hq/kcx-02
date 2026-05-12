# Demo Database Workflow

This project includes a safe, isolated demo-database flow for full end-to-end app validation.

## 1) Create demo DB

Create a separate PostgreSQL database whose name contains `demo`.

Examples:
- `kcx_demo`
- `kcx_demo_local`

Do not reuse your normal dev/prod DB.

## 2) Environment

Use either:
- `DEMO_DATABASE_URL` (recommended), or
- `NODE_ENV=demo` with `DB_URL` set to a demo DB URL.

Recommended `.env.demo` example:

```env
DEMO_DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/kcx_demo?sslmode=require
```

Then export/load it into your shell before running commands.

## 3) Safety guards

Demo scripts refuse to run unless:
- database URL resolves to a DB name containing `demo`
- DB name does not look production-like (`prod`, `production`, `staging`, `live`, `main`)
- `DEMO_DATABASE_URL` is set, or `NODE_ENV=demo` + `DB_URL`

This prevents accidental deletion of non-demo data.

## 4) Commands

Run from `backend/`:

```bash
npm run db:demo:reset
npm run db:demo:seed
npm run db:demo:rebuild
npm run recommendations:ec2:sync
```

### What each command does

- `db:demo:reset`
  - Connects only to demo DB
  - Drops and recreates `public` schema

- `db:demo:seed`
  - Seeds full demo identity + cloud + billing + EC2/volume/snapshot facts
  - Does not directly insert `fact_recommendations`
  - Adds seed marker in metadata/tags: `demo-db-v1`

- `db:demo:rebuild`
  1. connects only to demo DB
  2. resets schema
  3. runs baseline schema migration (`20260428183000-create-full-schema-from-models.ts`)
  4. seeds full demo data
  5. prints demo login + tenant + cloud connection + billing source info

- `recommendations:ec2:sync`
  - Uses actual backend EC2 optimization sync services
  - Generates recommendations from current DB scope + connected AWS context
  - Writes through normal recommendation pipeline (no direct table inserts)

## 5) Demo identity

- email: `demo@example.com`
- password: `Demo@123456`
- name: `Demo User`
- tenant: `Demo Organization`
- cloud connection: `Demo AWS Account` (provider: `aws`, status: `active`)

## 6) Seeded scope

Includes:
- auth user + tenant + role context
- cloud provider + cloud connection
- billing source
- client cloud account
- dim billing account/sub account
- dim regions: `us-east-1`, `us-west-2`, `ap-south-1`
- dim resources + dim tags
- fact cost line items
- EC2 instance inventory + daily/hourly utilization
- EC2 daily cost + coverage facts
- EBS volume inventory + daily/hourly utilization + daily cost fact
- snapshot inventory
- recommendation generation is separate via `npm run recommendations:ec2:sync`

## 7) Scenario map

Last 30 days seeded with deterministic scenarios:

- `i-demo-idle-001` (idle)
- `i-demo-under-001` (underutilized)
- `i-demo-over-001` (overutilized)
- `i-demo-healthy-001` (healthy/no compute recommendation)
- `i-demo-uncovered-001` (on-demand uncovered)
- `i-demo-storage-heavy-001` (volume-heavy)
- `i-demo-stopped-001` (stopped with storage cost)
- `vol-demo-unattached-001` (unattached)
- `snap-demo-old-001` (old snapshot)

## 8) Cleanup / refresh

Use:

```bash
npm run db:demo:rebuild
```

to safely reset and reseed demo DB end-to-end.
