import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    const { sequelize } = await import("../models/index.js");

    // Create all model-driven tables, indexes, and constraints in one pass.
    await sequelize.sync({ alter: false });

    // Keep raw-SQL-only tables aligned with latest schema.
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS s3_policy_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cloud_connection_id UUID,
  billing_source_id BIGINT,
  provider_id BIGINT,
  service_name VARCHAR(32) NOT NULL DEFAULT 'S3',
  policy_type VARCHAR(64) NOT NULL DEFAULT 'LIFECYCLE',
  account_id VARCHAR(20),
  region VARCHAR(64),
  bucket_name TEXT NOT NULL,
  rule_name TEXT,
  scope_type VARCHAR(32),
  scope_prefix TEXT,
  status VARCHAR(32) NOT NULL,
  error_message TEXT,
  request_payload_json JSONB,
  response_payload_json JSONB,
  created_by_user_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_s3_policy_action_logs_tenant_created
  ON s3_policy_action_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_s3_policy_action_logs_bucket
  ON s3_policy_action_logs(bucket_name);

CREATE TABLE IF NOT EXISTS s3_bucket_daily_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  report_date DATE NOT NULL,
  bucket_name TEXT NOT NULL,
  account_id VARCHAR(20),
  region VARCHAR(64),
  anomaly_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 50,
  storage_gib_current NUMERIC(30,6),
  storage_gib_7d_ago NUMERIC(30,6),
  growth_gib NUMERIC(30,6),
  growth_percentage NUMERIC(12,4),
  monthly_cost_impact NUMERIC(20,6),
  reason TEXT,
  recommended_action TEXT,
  evidence_json JSONB,
  fingerprint VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, report_date, bucket_name, anomaly_type)
);

CREATE INDEX IF NOT EXISTS idx_s3_bucket_daily_anomalies_tenant_date
  ON s3_bucket_daily_anomalies(tenant_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_s3_bucket_daily_anomalies_severity
  ON s3_bucket_daily_anomalies(tenant_id, severity, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_s3_bucket_daily_anomalies_bucket
  ON s3_bucket_daily_anomalies(tenant_id, bucket_name, report_date DESC);

CREATE TABLE IF NOT EXISTS s3_bucket_optimization_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  report_date DATE NOT NULL,
  bucket_name TEXT NOT NULL,
  account_id VARCHAR(20),
  region VARCHAR(64),
  optimization_score NUMERIC(8,4) NOT NULL,
  priority_level VARCHAR(10) NOT NULL,
  primary_reason TEXT,
  top_issues_json JSONB,
  recommended_next_action TEXT,
  estimated_monthly_saving NUMERIC(20,6) NOT NULL DEFAULT 0,
  estimated_annual_saving NUMERIC(20,6) NOT NULL DEFAULT 0,
  factor_scores_json JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, report_date, bucket_name)
);

CREATE INDEX IF NOT EXISTS idx_s3_bucket_optimization_scores_rank
  ON s3_bucket_optimization_scores(tenant_id, report_date DESC, optimization_score ASC);

CREATE TABLE IF NOT EXISTS s3_bucket_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  report_date DATE NOT NULL,
  bucket_name TEXT NOT NULL,
  account_id VARCHAR(20),
  region VARCHAR(64),
  health_score NUMERIC(8,4) NOT NULL,
  health_label VARCHAR(40) NOT NULL,
  dimension_scores_json JSONB,
  risk_flags_json JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, report_date, bucket_name)
);

CREATE INDEX IF NOT EXISTS idx_s3_bucket_health_scores_rank
  ON s3_bucket_health_scores(tenant_id, report_date DESC, health_score ASC);

CREATE TABLE IF NOT EXISTS s3_lifecycle_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  recommendation_id VARCHAR(255) NOT NULL,
  report_date DATE NOT NULL,
  bucket_name TEXT NOT NULL,
  category VARCHAR(80) NOT NULL,
  recommendation TEXT NOT NULL,
  reason TEXT,
  confidence VARCHAR(20) NOT NULL,
  implementation_complexity VARCHAR(20) NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  required_owner_action TEXT,
  estimated_monthly_saving NUMERIC(20,6) NOT NULL DEFAULT 0,
  estimated_annual_saving NUMERIC(20,6) NOT NULL DEFAULT 0,
  signals_json JSONB,
  status VARCHAR(30) NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, recommendation_id)
);

CREATE INDEX IF NOT EXISTS idx_s3_lifecycle_recommendations_status
  ON s3_lifecycle_recommendations(tenant_id, status, report_date DESC);

CREATE TABLE IF NOT EXISTS s3_bucket_owner_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  bucket_name TEXT NOT NULL,
  account_id VARCHAR(20),
  owner_team VARCHAR(255),
  application_name VARCHAR(255),
  business_unit VARCHAR(255),
  environment VARCHAR(50),
  cost_center VARCHAR(100),
  technical_owner VARCHAR(255),
  finance_owner VARCHAR(255),
  criticality VARCHAR(20),
  support_channel VARCHAR(255),
  source VARCHAR(50) NOT NULL,
  source_rank INTEGER NOT NULL DEFAULT 0,
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 50,
  effective_from DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  override_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_s3_bucket_owner_mapping_active
  ON s3_bucket_owner_mapping(tenant_id, bucket_name)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_s3_bucket_owner_mapping_owner
  ON s3_bucket_owner_mapping(tenant_id, owner_team, business_unit);

CREATE TABLE IF NOT EXISTS s3_savings_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  report_date DATE NOT NULL,
  bucket_name TEXT NOT NULL,
  savings_type VARCHAR(80) NOT NULL,
  monthly_saving NUMERIC(20,6) NOT NULL DEFAULT 0,
  annual_saving NUMERIC(20,6) NOT NULL DEFAULT 0,
  confidence VARCHAR(20) NOT NULL,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
  assumptions_json JSONB,
  limitations_json JSONB,
  inputs_json JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, report_date, bucket_name, savings_type)
);

CREATE INDEX IF NOT EXISTS idx_s3_savings_estimates_rank
  ON s3_savings_estimates(tenant_id, report_date DESC, monthly_saving DESC);

CREATE TABLE IF NOT EXISTS s3_request_cost_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  report_date DATE NOT NULL,
  bucket_name TEXT NOT NULL,
  operation VARCHAR(120) NOT NULL,
  request_count NUMERIC(30,0),
  request_cost NUMERIC(20,6) NOT NULL DEFAULT 0,
  request_cost_percentage NUMERIC(10,4),
  cost_per_1k_requests NUMERIC(20,6),
  cost_per_gb NUMERIC(20,6),
  cost_per_object NUMERIC(20,6),
  anomaly_flag BOOLEAN NOT NULL DEFAULT false,
  recommendation TEXT,
  evidence_json JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, report_date, bucket_name, operation)
);

CREATE INDEX IF NOT EXISTS idx_s3_request_cost_insights_rank
  ON s3_request_cost_insights(tenant_id, report_date DESC, request_cost DESC);

CREATE TABLE IF NOT EXISTS s3_finops_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL,
  bucket_name TEXT NOT NULL,
  account_id VARCHAR(20),
  region VARCHAR(64),
  owner_team VARCHAR(255),
  application_name VARCHAR(255),
  business_unit VARCHAR(255),
  category VARCHAR(80) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  priority VARCHAR(10) NOT NULL,
  recommendation TEXT NOT NULL,
  estimated_monthly_saving NUMERIC(20,6) NOT NULL DEFAULT 0,
  estimated_annual_saving NUMERIC(20,6) NOT NULL DEFAULT 0,
  confidence VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'NEW',
  assigned_to VARCHAR(255),
  source_signal TEXT,
  evidence_json JSONB,
  action_fingerprint VARCHAR(255),
  due_at TIMESTAMP,
  sla_breached_at TIMESTAMP,
  last_seen_at TIMESTAMP,
  dismissed_reason TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, action_id)
);

CREATE INDEX IF NOT EXISTS idx_s3_finops_action_items_status
  ON s3_finops_action_items(tenant_id, status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_s3_finops_action_items_owner
  ON s3_finops_action_items(tenant_id, owner_team, status);
CREATE INDEX IF NOT EXISTS idx_s3_finops_action_items_due
  ON s3_finops_action_items(tenant_id, due_at);

CREATE TABLE IF NOT EXISTS s3_finops_action_item_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_item_id UUID NOT NULL REFERENCES s3_finops_action_items(id) ON DELETE CASCADE,
  changed_by UUID,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  reason TEXT,
  changed_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_s3_finops_action_item_audit_action
  ON s3_finops_action_item_audit(action_item_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS recommendation_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  recommendation_id BIGINT NOT NULL,
  previous_status TEXT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NULL,
  snoozed_until TIMESTAMPTZ NULL,
  changed_by TEXT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_status_events_tenant_recommendation
  ON recommendation_status_events (tenant_id, recommendation_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS s3_cost_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cloud_connection_id UUID,
  billing_source_id BIGINT,
  provider_id BIGINT,
  sub_account_key BIGINT,
  region_key BIGINT,
  account_id VARCHAR(20),
  region VARCHAR(64),
  bucket_name TEXT NOT NULL,
  usage_date DATE NOT NULL,
  cost_category VARCHAR(32) NOT NULL,
  storage_class VARCHAR(64) NOT NULL,
  usage_type TEXT NOT NULL,
  operation TEXT NOT NULL,
  product_family TEXT NOT NULL,
  pricing_unit VARCHAR(64) NOT NULL DEFAULT 'Units',
  total_cost NUMERIC(20,12) NOT NULL DEFAULT 0,
  usage_quantity NUMERIC(24,8) NOT NULL DEFAULT 0,
  currency_code VARCHAR(12) NOT NULL DEFAULT 'USD',
  line_item_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_s3_cost_daily_row
  ON s3_cost_daily(
    tenant_id, cloud_connection_id, billing_source_id, provider_id, sub_account_key, region_key,
    account_id, region, bucket_name, usage_date, cost_category, storage_class, usage_type, operation, product_family, pricing_unit, currency_code
  );

CREATE INDEX IF NOT EXISTS idx_s3_cost_daily_tenant_id
  ON s3_cost_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_s3_cost_daily_cloud_connection_id
  ON s3_cost_daily(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_s3_cost_daily_account_id
  ON s3_cost_daily(account_id);
CREATE INDEX IF NOT EXISTS idx_s3_cost_daily_region
  ON s3_cost_daily(region);
CREATE INDEX IF NOT EXISTS idx_s3_cost_daily_bucket_name
  ON s3_cost_daily(bucket_name);
CREATE INDEX IF NOT EXISTS idx_s3_cost_daily_usage_date
  ON s3_cost_daily(usage_date);
CREATE INDEX IF NOT EXISTS idx_s3_cost_daily_cost_category
  ON s3_cost_daily(cost_category);
`);
  },

  async down(_queryInterface: QueryInterface): Promise<void> {
    // Intentionally no destructive rollback for full-schema snapshot migration.
  },
};

export default migration;
