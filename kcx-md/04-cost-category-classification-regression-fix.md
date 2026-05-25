# 04 - Cost Category Classification Regression Fix

## Problem
- Redis/ElastiCache storage costs regressed to `Compute` or `Other`.
- Top Cost Driver became incorrect.

## Backend Source Fixed
- `backend/src/features/billing/services/db-cost-history.service.ts`

## Core Fix
- Added/strengthened high-priority storage guard in `COST_CATEGORY_SQL` for Redis/ElastiCache storage signals.
- Ensured storage classification occurs before generic fallback branches.

## Materialized Data Recompute
- Rebuilt:
  - `db_cost_history_daily`
  - `fact_db_resource_daily`
- Using backfill script for targeted ingestion run.

## Validation Enhancements
- Added verifier script:
  - `backend/scripts/verify-db-redis-storage-classification.ts`
- Added npm script alias for verifier.

## Extra Engine Label Correction
- In `DB_ENGINE_SQL`, service-based mapping updates included:
  - `AmazonDynamoDB -> DynamoDB`
  - `AmazonElastiCache -> Redis`
