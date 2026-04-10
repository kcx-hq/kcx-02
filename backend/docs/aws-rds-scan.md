# AWS RDS Scan

## 1. Objective
This scan maps the current backend database wiring so the existing KCX backend can be pointed to an AWS RDS PostgreSQL instance with minimal, safe changes and no runtime restructuring.

## 2. Current DB Configuration Discovery
- Primary DB configuration lives in `backend/src/config/env.ts`, `backend/src/models/index.ts`, and `backend/src/config/db.config.ts`.
- Runtime DB env is read centrally in `backend/src/config/env.ts` using `dbUrl: requiredEnv(process.env.DB_URL, "DB_URL")`.
- Runtime connection is created in `backend/src/models/index.ts` via `new Sequelize(dbUrl.toString(), { dialect: "postgres", dialectOptions.ssl... })`.
- The codebase currently uses a single connection URL (`DB_URL`) and does not use discrete DB fields (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`) anywhere in backend runtime code.
- SSL behavior is hardcoded in runtime and migration config:
  - `backend/src/models/index.ts` appends `sslmode=require` to `DB_URL` if absent and sets `dialectOptions.ssl = { require: true, rejectUnauthorized: false }`.
  - `backend/src/config/db.config.ts` does the same for Sequelize CLI environments.
- Sequelize CLI config path is `dist/src/config/db.config.js` (from `.sequelizerc` and package scripts), so migrations/seeds depend on the compiled config.
- `.env.example` also documents only `DB_URL` for DB configuration.

## 3. Sequelize Integration Flow
- Initialization:
  - `backend/server.ts` imports `sequelize` from `backend/src/models/index.ts`.
  - `backend/src/models/index.ts` constructs Sequelize immediately at module load.
- Model registration:
  - All model factories are imported and instantiated in `backend/src/models/index.ts`.
  - Associations are also defined in the same file; this file is the active model registry.
- Connection test/auth:
  - `backend/server.ts` calls `await sequelize.authenticate()` inside `startServer()` before `server.listen(...)`.
  - On failure, server startup exits with code 1.
- Startup dependency chain:
  - `server.ts` imports `env` and `models/index` at top level.
  - `env.ts` throws immediately if `DB_URL` is missing, so startup can fail before `startServer()` executes.
- Sync flow:
  - No `sequelize.sync()` is used in runtime.
  - Schema lifecycle is migration-driven (`sequelize-cli` via npm scripts).

## 4. Environment Variable Mapping
Currently relevant env vars found in code (DB + config interaction context):

- currently used
  - `DB_URL`
  - `NODE_ENV`
  - `PORT`
  - `LOG_LEVEL`
  - `AWS_REGION`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_SESSION_TOKEN`
  - `AWS_VALIDATION_ACCESS_KEY_ID`
  - `AWS_VALIDATION_SECRET_ACCESS_KEY`
  - `AWS_VALIDATION_SESSION_TOKEN`
  - `AWS_CALLBACK_URL`
  - `AWS_FILE_EVENT_CALLBACK_URL`
  - `AWS_S3_ENDPOINT`
  - `AWS_S3_FORCE_PATH_STYLE`
  - `AWS_FIRST_FILE_POLLING_INTERVAL_MS`
  - `RAW_BILLING_FILES_BUCKET`
  - `BILLING_INGESTION_BATCH_SIZE`
  - `BILLING_INGESTION_ROW_CONCURRENCY`
  - `BILLING_INGESTION_STATUS_MIN_INTERVAL_MS`
  - `BILLING_S3_UPLOAD_SESSION_TTL_MINUTES`
  - `FRONTEND_BASE_URL`
  - `MAILGUN_API_KEY`
  - `MAILGUN_DOMAIN`
  - `MAILGUN_FROM`
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`
  - `CAL_API_KEY`
  - `CAL_API_BASE_URL`
  - `CAL_API_VERSION`
  - `CAL_SLOTS_API_VERSION`
  - `CAL_BOOKINGS_API_VERSION`
  - `CAL_EVENT_TYPE_ID`
  - `CAL_TIMEZONE`
  - `CAL_RESERVATION_TTL_MINUTES`
  - `RESET_TOKEN_TTL_MINUTES`
  - `SESSION_TTL_HOURS`

- possibly supported
  - `DB_URL` query parameter `sslmode` (code appends `sslmode=require` if missing)
  - Additional CloudFormation-related AWS env read directly via `process.env` in `backend/src/features/cloud-connections/aws/auto-connection/aws-cloudformation-url.ts`:
    - `AWS_PARENT_TEMPLATE_URL`
    - `AWS_BILLING_TEMPLATE_URL`
    - `AWS_ACTION_ROLE_TEMPLATE_URL`
    - `AWS_EC2_MODULE_TEMPLATE_URL`
    - `AWS_FILE_EVENT_CALLBACK_URL`
    - `AWS_KCX_PRINCIPAL_ARN`

- missing but likely needed for RDS
  - No separate DB SSL toggle env (for example, no `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`, `DATABASE_SSLMODE`) is currently exposed.
  - No discrete DB field env support (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DATABASE_URL`) is currently implemented.
  - No pool tuning env mapping exists for Sequelize (`pool.max`, `pool.min`, etc.).

## 5. Current Risk / Compatibility Findings
- DB URL shape is single-source-only:
  - Runtime and migration paths both expect `DB_URL`; discrete DB fields are not consumed.
- SSL assumptions are hardcoded:
  - SSL is always required and certificate verification is disabled (`rejectUnauthorized: false`), which is permissive but not strict TLS validation.
- Runtime vs migration coupling:
  - Runtime uses `src/models/index.ts` configuration.
  - Migration CLI uses `dist/src/config/db.config.js`; both must stay aligned.
- Import-time startup failure risk:
  - Missing/invalid `DB_URL` can throw during module import (`env.ts` and URL parsing), before `startServer()` error handling.
- No auto-sync fallback:
  - Since `sequelize.sync()` is not used, schema readiness depends entirely on running migrations against the target DB.
- PostgreSQL-specific migration/model footprint:
  - Migrations use Postgres catalogs/types/extensions (`pg_constraint`, `pg_type`, `::regclass`, `CREATE EXTENSION pgcrypto`, JSONB, `gen_random_uuid()`).
  - Target DB must be PostgreSQL with required extension support/permissions.
- Render-specific assumptions:
  - No Render-specific DB configuration assumptions found in backend DB wiring.
- AWS IAM env presence unrelated to DB but potentially confusing:
  - Backend already relies on many AWS credential vars for cloud-connection/billing features.
  - These are separate from DB connection and should not be mixed with RDS DB authentication configuration.

## 6. Exact Requirements For AWS RDS Integration
Based on the current codebase, connecting AWS RDS PostgreSQL requires:

- Required env var contract
  - Provide a valid `DB_URL` that points to the RDS PostgreSQL endpoint/database.
  - Keep URL parseable by `new URL(...)` and compatible with Sequelize/Postgres dialect.
- Keep PostgreSQL dialect
  - No dialect changes are needed; code is fixed to `dialect: "postgres"`.
- SSL compatibility with current code
  - Current code enforces SSL and injects `sslmode=require` when absent.
  - RDS connection must accept SSL under `dialectOptions.ssl.require=true` with `rejectUnauthorized=false` (as currently implemented).
- Migration path compatibility
  - `db:migrate` / `db:seed` must run against the same RDS-backed `DB_URL` through `dist/src/config/db.config.js`.
- Schema prerequisites on target DB
  - Run migrations on RDS before app start where needed.
  - Ensure Postgres extension use in migrations (notably `pgcrypto`) is allowed in the selected RDS setup.
- No additional discrete DB env fields expected by current code
  - Do not rely on `DB_HOST`/`DB_PORT`/etc. unless code is later extended.

## 7. Minimal Change Strategy
- Use existing configuration contract unchanged:
  - Keep `DB_URL` as the only DB input.
  - Point `DB_URL` to the AWS RDS PostgreSQL instance.
- Keep runtime and migration configs aligned:
  - Continue using current runtime (`models/index.ts`) and CLI (`db.config.ts`) URL+SSL approach.
- Apply schema first:
  - Run existing migrations against RDS before normal startup.
- Defer optional hardening/cleanup to later:
  - Any SSL verification tightening, env contract expansion, or pool tuning should be a second pass after initial successful RDS cutover.

## 8. Files Relevant To Future Implementation
- `backend/src/config/env.ts`
- `backend/src/models/index.ts`
- `backend/src/config/db.config.ts`
- `backend/server.ts`
- `backend/package.json`
- `backend/.sequelizerc`
- `backend/.env`
- `backend/.env.example`
- `backend/src/types/env.d.ts`
- `backend/src/migrations/*.ts`

## 9. What Should NOT Be Changed Yet
- Do not change AWS IAM credential values already present in `backend/.env`.
- Do not refactor runtime DB initialization flow in `backend/src/models/index.ts` yet.
- Do not switch from `DB_URL` to discrete DB env fields in the first pass.
- Do not alter migration history files under `backend/src/migrations` unless a concrete RDS incompatibility is confirmed.
- Do not introduce `sequelize.sync()` into startup.
- Do not mix unrelated AWS CloudFormation/config env refactors into the first RDS connection pass.

## 10. Final Summary
- Current DB config shape: single `DB_URL`, Postgres-only Sequelize, SSL forced in both runtime and Sequelize CLI config.
- Likely RDS integration shape: supply an RDS PostgreSQL `DB_URL` (SSL-capable), run existing migrations against it, keep current runtime wiring unchanged.
- Minimum required next implementation step: wire the deployment/runtime `DB_URL` to the target RDS instance and validate migration + startup authentication on that DB.
