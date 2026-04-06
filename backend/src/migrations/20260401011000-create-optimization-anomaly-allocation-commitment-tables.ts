/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS resource_inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  cloud_connection_id UUID NOT NULL REFERENCES cloud_connections(id) ON DELETE CASCADE,
  provider_id BIGINT NOT NULL REFERENCES cloud_providers(id) ON DELETE RESTRICT,
  resource_id TEXT NOT NULL,
  resource_name TEXT,
  resource_type TEXT,
  region_id TEXT,
  account_id TEXT,
  state TEXT,
  metadata_json JSONB,
  discovered_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ris_tenant_id ON resource_inventory_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ris_cloud_connection_id ON resource_inventory_snapshots(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_ris_provider_id ON resource_inventory_snapshots(provider_id);
CREATE INDEX IF NOT EXISTS idx_ris_resource_id ON resource_inventory_snapshots(resource_id);
CREATE INDEX IF NOT EXISTS idx_ris_discovered_at ON resource_inventory_snapshots(discovered_at);
`);

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS resource_utilization_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  cloud_connection_id UUID NOT NULL REFERENCES cloud_connections(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL,
  usage_date DATE NOT NULL,
  cpu_avg NUMERIC(10,4),
  memory_avg NUMERIC(10,4),
  network_in_bytes BIGINT,
  network_out_bytes BIGINT,
  idle_score NUMERIC(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rud_connection_resource_date
  ON resource_utilization_daily(cloud_connection_id, resource_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_rud_tenant_id ON resource_utilization_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rud_usage_date ON resource_utilization_daily(usage_date);
`);

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS fact_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  cloud_connection_id UUID NOT NULL REFERENCES cloud_connections(id) ON DELETE CASCADE,
  detected_at TIMESTAMP NOT NULL,
  usage_date DATE NOT NULL,
  anomaly_scope TEXT,
  service_key BIGINT REFERENCES dim_service(id) ON DELETE SET NULL,
  region_key BIGINT REFERENCES dim_region(id) ON DELETE SET NULL,
  resource_key BIGINT REFERENCES dim_resource(id) ON DELETE SET NULL,
  expected_cost NUMERIC(18,6),
  actual_cost NUMERIC(18,6),
  delta_cost NUMERIC(18,6),
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  root_cause_hint TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_fact_anomalies_severity CHECK (severity IN ('low', 'medium', 'high')),
  CONSTRAINT chk_fact_anomalies_status CHECK (status IN ('open', 'resolved', 'ignored'))
);

CREATE INDEX IF NOT EXISTS idx_fact_anomalies_tenant_id ON fact_anomalies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fact_anomalies_connection_date ON fact_anomalies(cloud_connection_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_fact_anomalies_status ON fact_anomalies(status);
CREATE INDEX IF NOT EXISTS idx_fact_anomalies_severity ON fact_anomalies(severity);
`);

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS fact_recommendations (
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

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS fact_cost_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id BIGINT NOT NULL REFERENCES fact_cost_line_items(id) ON DELETE CASCADE,
  tag_key TEXT,
  tag_value TEXT,
  allocated_cost NUMERIC(18,6),
  allocation_type TEXT,
  allocation_source TEXT,
  usage_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_cost_allocations_fact_id ON fact_cost_allocations(fact_id);
CREATE INDEX IF NOT EXISTS idx_fact_cost_allocations_usage_date ON fact_cost_allocations(usage_date);
CREATE INDEX IF NOT EXISTS idx_fact_cost_allocations_tag_key_value ON fact_cost_allocations(tag_key, tag_value);
`);

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS fact_commitment_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  cloud_connection_id UUID NOT NULL REFERENCES cloud_connections(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  service_name TEXT,
  covered_cost NUMERIC(18,6),
  uncovered_cost NUMERIC(18,6),
  ri_covered_cost NUMERIC(18,6),
  sp_covered_cost NUMERIC(18,6),
  coverage_percent NUMERIC(5,2),
  utilization_percent NUMERIC(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_commitment_coverage_tenant_id ON fact_commitment_coverage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fact_commitment_coverage_connection_date
  ON fact_commitment_coverage(cloud_connection_id, usage_date);
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS fact_commitment_coverage;
DROP TABLE IF EXISTS fact_cost_allocations;
DROP TABLE IF EXISTS fact_recommendations;
DROP TABLE IF EXISTS fact_anomalies;
DROP TABLE IF EXISTS resource_utilization_daily;
DROP TABLE IF EXISTS resource_inventory_snapshots;
`);
  },
};

export default migration;


