/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS idx_fact_recommendations_tenant_id;
DROP INDEX IF EXISTS idx_fact_recommendations_connection_id;
DROP INDEX IF EXISTS idx_fact_recommendations_status;
DROP INDEX IF EXISTS idx_fact_recommendations_type;
DROP TABLE IF EXISTS fact_recommendations;

CREATE TABLE fact_recommendations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  aws_account_id VARCHAR(50) NOT NULL,
  aws_region_code VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  recommendation_type VARCHAR(100) NOT NULL,
  service_key BIGINT NULL,
  sub_account_key BIGINT NULL,
  region_key BIGINT NULL,
  resource_id VARCHAR(255) NOT NULL,
  resource_arn TEXT NULL,
  resource_name VARCHAR(255) NULL,
  current_resource_type VARCHAR(100) NULL,
  recommended_resource_type VARCHAR(100) NULL,
  current_monthly_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
  estimated_monthly_savings DECIMAL(18,4) NOT NULL DEFAULT 0,
  projected_monthly_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
  performance_risk_score DECIMAL(10,4) NULL,
  performance_risk_level VARCHAR(20) NULL,
  source_system VARCHAR(50) NOT NULL DEFAULT 'AWS_COMPUTE_OPTIMIZER',
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  effort_level VARCHAR(20) NULL,
  risk_level VARCHAR(20) NULL,
  recommendation_title VARCHAR(255) NULL,
  recommendation_text TEXT NULL,
  observation_start TIMESTAMP NULL,
  observation_end TIMESTAMP NULL,
  raw_payload_json TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS fact_recommendations;

CREATE TABLE fact_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  cloud_connection_id UUID NOT NULL REFERENCES cloud_connections(id) ON DELETE CASCADE,
  recommendation_type TEXT,
  resource_id TEXT,
  service_name TEXT,
  potential_monthly_savings NUMERIC(18,6),
  risk_level TEXT,
  confidence_score NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'open',
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  CONSTRAINT chk_fact_recommendations_status CHECK (status IN ('open', 'accepted', 'dismissed', 'completed')),
  CONSTRAINT chk_fact_recommendations_risk_level CHECK (risk_level IN ('low', 'medium', 'high') OR risk_level IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_fact_recommendations_tenant_id ON fact_recommendations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fact_recommendations_connection_id ON fact_recommendations(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_fact_recommendations_status ON fact_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_fact_recommendations_type ON fact_recommendations(recommendation_type);
`);
  },
};

export default migration;
