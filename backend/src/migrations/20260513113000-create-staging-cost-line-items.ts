import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS staging_cost_line_items (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  billing_source_id BIGINT,
  ingestion_run_id BIGINT,
  provider_id BIGINT NOT NULL,
  billing_account_key BIGINT,
  sub_account_key BIGINT,
  region_key BIGINT,
  service_key BIGINT,
  resource_key BIGINT,
  sku_key BIGINT,
  charge_key BIGINT,
  tag_id BIGINT,
  tag_ids_json JSONB,
  usage_date_key BIGINT,
  billing_period_start_date_key BIGINT,
  billing_period_end_date_key BIGINT,
  billed_cost NUMERIC(38,18),
  effective_cost NUMERIC(38,18),
  list_cost NUMERIC(38,18),
  consumed_quantity NUMERIC(38,18),
  pricing_quantity NUMERIC(38,18),
  usage_start_time TIMESTAMP WITH TIME ZONE,
  usage_end_time TIMESTAMP WITH TIME ZONE,
  usage_type TEXT,
  product_usage_type TEXT,
  product_family TEXT,
  from_location TEXT,
  to_location TEXT,
  from_region_code TEXT,
  to_region_code TEXT,
  bill_type TEXT,
  line_item_description TEXT,
  legal_entity TEXT,
  operation TEXT,
  line_item_type TEXT,
  pricing_term TEXT,
  purchase_option TEXT,
  public_on_demand_cost NUMERIC(38,18),
  public_on_demand_rate NUMERIC(38,18),
  discount_amount NUMERIC(38,18),
  bundled_discount NUMERIC(38,18),
  credit_amount NUMERIC(38,18),
  refund_amount NUMERIC(38,18),
  tax_cost NUMERIC(38,18),
  reservation_arn TEXT,
  savings_plan_arn TEXT,
  savings_plan_type TEXT,
  ingested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE staging_cost_line_items
  ADD COLUMN IF NOT EXISTS tag_ids_json JSONB;

CREATE INDEX IF NOT EXISTS idx_staging_cost_line_items_ingestion_run_id
  ON staging_cost_line_items(ingestion_run_id);

CREATE INDEX IF NOT EXISTS idx_staging_cost_line_items_billing_source_usage_start
  ON staging_cost_line_items(billing_source_id, usage_start_time);

CREATE INDEX IF NOT EXISTS idx_staging_cost_line_items_tenant_billing_source_usage_start
  ON staging_cost_line_items(tenant_id, billing_source_id, usage_start_time);
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS staging_cost_line_items;
`);
  },
};

export default migration;
