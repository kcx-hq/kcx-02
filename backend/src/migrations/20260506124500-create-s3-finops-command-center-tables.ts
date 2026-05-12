import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS s3_finops_action_item_audit;
DROP TABLE IF EXISTS s3_finops_action_items;
DROP TABLE IF EXISTS s3_request_cost_insights;
DROP TABLE IF EXISTS s3_savings_estimates;
DROP TABLE IF EXISTS s3_bucket_owner_mapping;
DROP TABLE IF EXISTS s3_lifecycle_recommendations;
DROP TABLE IF EXISTS s3_bucket_health_scores;
DROP TABLE IF EXISTS s3_bucket_optimization_scores;
DROP TABLE IF EXISTS s3_bucket_daily_anomalies;
`);
  },
};

export default migration;
