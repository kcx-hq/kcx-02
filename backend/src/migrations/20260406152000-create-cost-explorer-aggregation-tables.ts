import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS agg_cost_hourly (
  hour_start TIMESTAMP NOT NULL,
  usage_date DATE NOT NULL,
  billing_period_start_date DATE NOT NULL,

  service_key INT NOT NULL,
  sub_account_key INT NOT NULL,
  region_key INT NOT NULL,

  billed_cost DECIMAL(18,4) DEFAULT 0,
  effective_cost DECIMAL(18,4) DEFAULT 0,
  list_cost DECIMAL(18,4) DEFAULT 0,
  usage_quantity DECIMAL(18,4) DEFAULT 0,

  currency_code VARCHAR(10) DEFAULT 'USD',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agg_cost_hourly_bucket_dims_currency
  ON agg_cost_hourly(hour_start, service_key, sub_account_key, region_key, currency_code);
CREATE INDEX IF NOT EXISTS idx_agg_cost_hourly_usage_date ON agg_cost_hourly(usage_date);
CREATE INDEX IF NOT EXISTS idx_agg_cost_hourly_billing_period_start_date
  ON agg_cost_hourly(billing_period_start_date);
CREATE INDEX IF NOT EXISTS idx_agg_cost_hourly_dims
  ON agg_cost_hourly(service_key, sub_account_key, region_key);
`);

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS agg_cost_daily (
  usage_date DATE NOT NULL,
  billing_period_start_date DATE NOT NULL,

  service_key INT NOT NULL,
  sub_account_key INT NOT NULL,
  region_key INT NOT NULL,

  billed_cost DECIMAL(18,4) DEFAULT 0,
  effective_cost DECIMAL(18,4) DEFAULT 0,
  list_cost DECIMAL(18,4) DEFAULT 0,
  usage_quantity DECIMAL(18,4) DEFAULT 0,

  currency_code VARCHAR(10) DEFAULT 'USD',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agg_cost_daily_bucket_dims_currency
  ON agg_cost_daily(usage_date, service_key, sub_account_key, region_key, currency_code);
CREATE INDEX IF NOT EXISTS idx_agg_cost_daily_billing_period_start_date
  ON agg_cost_daily(billing_period_start_date);
CREATE INDEX IF NOT EXISTS idx_agg_cost_daily_dims
  ON agg_cost_daily(service_key, sub_account_key, region_key);
`);

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS agg_cost_monthly (
  month_start DATE NOT NULL,

  service_key INT NOT NULL,
  sub_account_key INT NOT NULL,
  region_key INT NOT NULL,

  billed_cost DECIMAL(18,4) DEFAULT 0,
  effective_cost DECIMAL(18,4) DEFAULT 0,
  list_cost DECIMAL(18,4) DEFAULT 0,
  usage_quantity DECIMAL(18,4) DEFAULT 0,

  currency_code VARCHAR(10) DEFAULT 'USD',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agg_cost_monthly_bucket_dims_currency
  ON agg_cost_monthly(month_start, service_key, sub_account_key, region_key, currency_code);
CREATE INDEX IF NOT EXISTS idx_agg_cost_monthly_dims
  ON agg_cost_monthly(service_key, sub_account_key, region_key);
`);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS agg_cost_monthly;
DROP TABLE IF EXISTS agg_cost_daily;
DROP TABLE IF EXISTS agg_cost_hourly;
`);
  },
};

export default migration;
