# Backend DB Config (PostgreSQL on AWS RDS + Sequelize)

This backend is already wired for PostgreSQL with Sequelize and expects a single connection string via `DB_URL`.

## 1. Current Project Contract

- Runtime DB config: `backend/src/models/index.ts`
- Sequelize CLI/migrations config: `backend/src/config/db.config.ts`
- Env loader: `backend/src/config/env.ts`
- Required DB env var: `DB_URL`
- Dialect: `postgres`
- SSL: enforced in both runtime and migration config

## 2. Environment Setup

Use a PostgreSQL connection URL for AWS RDS:

```env
DB_URL=postgresql://<username>:<password>@<rds-endpoint>:5432/<database>?sslmode=require
PORT=5000
LOG_LEVEL=info
NODE_ENV=production
```

Example:

```env
DB_URL=postgresql://app_user:strong_password@mydb.abc123xyz.us-east-1.rds.amazonaws.com:5432/kcx?sslmode=require
```

Notes:

- Keep `DB_URL` URL-encoded if password contains special characters.
- `DB_URL` is mandatory; startup fails fast if missing.
- Do not split DB config into `DB_HOST`, `DB_USER`, etc. unless code is changed to support that.

## 3. SSL Handling (AWS RDS)

Current behavior in code:

- If `sslmode` is missing in `DB_URL`, code adds `sslmode=require`.
- Sequelize uses:
  - `dialectOptions.ssl.require = true`
  - `dialectOptions.ssl.rejectUnauthorized = false`

This is compatible with common RDS setups and avoids certificate validation failures in many environments.

If you need strict TLS validation in production:

1. Mount AWS RDS CA bundle in the runtime environment.
2. Update Sequelize SSL config to `rejectUnauthorized: true` and provide `ca`.
3. Keep runtime config and CLI config aligned so migrations use the same TLS settings.

## 4. Migrations and Schema Management

This backend is migration-driven (no `sequelize.sync()`).

Use:

```bash
cd backend
npm run db:migrate
npm run db:seed
```

`db:migrate` builds first, then runs Sequelize CLI using:

- `dist/src/config/db.config.js`
- `dist/src/migrations`

Always run migrations against the target RDS database before starting production app instances.

## 5. Production Deployment Notes

1. Secrets management
- Store `DB_URL` in your platform secret manager (not in git).
- Rotate DB credentials periodically.

2. Network/security
- Place app and RDS in reachable VPC/subnet paths.
- Allow inbound PostgreSQL (`5432`) from app security group only.
- Keep RDS `Publicly Accessible` disabled unless explicitly required.

3. Startup ordering
- Run migrations first in CI/CD release step.
- Start backend only after successful migration.
- App startup performs `sequelize.authenticate()` and exits on DB failure.

4. Availability/ops
- Enable automated backups and define retention.
- Prefer Multi-AZ for production resilience.
- Monitor DB CPU, memory, connections, and storage.

5. Performance follow-up
- Pool tuning (`pool.max`, `pool.min`, etc.) is not currently env-driven in this codebase.
- Add pool tuning only as a targeted follow-up change if needed.

## 6. Quick Pre-Deploy Checklist

- `DB_URL` points to correct RDS instance/database.
- `sslmode=require` present (or auto-appended by code).
- Migrations ran successfully on target DB.
- App can pass `sequelize.authenticate()` in the deployment environment.
- Backups, monitoring, and least-privilege DB user are configured.
