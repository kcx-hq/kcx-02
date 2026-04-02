// @ts-nocheck
const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cloud_connection_id UUID REFERENCES cloud_connections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  budget_amount NUMERIC(18,6) NOT NULL,
  currency TEXT DEFAULT 'USD',
  period TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  scope_type TEXT,
  scope_filter JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_budgets_period CHECK (period IN ('monthly', 'weekly', 'yearly')),
  CONSTRAINT chk_budgets_scope_type CHECK (scope_type IN ('global', 'account', 'service', 'tag') OR scope_type IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_budgets_tenant_id ON budgets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_budgets_cloud_connection_id ON budgets(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period);
CREATE INDEX IF NOT EXISTS idx_budgets_start_date ON budgets(start_date);
`);

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS budget_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  current_spend NUMERIC(18,6),
  forecast_spend NUMERIC(18,6),
  threshold_percent NUMERIC(5,2),
  evaluated_at TIMESTAMP DEFAULT NOW(),
  status TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_budget_evaluations_status CHECK (status IN ('ok', 'warning', 'breached') OR status IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_budget_evaluations_budget_id ON budget_evaluations(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_evaluations_evaluated_at ON budget_evaluations(evaluated_at);
CREATE INDEX IF NOT EXISTS idx_budget_evaluations_status ON budget_evaluations(status);
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS budget_evaluations;
DROP TABLE IF EXISTS budgets;
`);
  },
};

export default migration;