/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE "fact_anomalies"
  DROP CONSTRAINT IF EXISTS "chk_fact_anomalies_anomaly_type",
  DROP CONSTRAINT IF EXISTS "chk_fact_anomalies_baseline_type";

ALTER TABLE "fact_anomalies"
  ADD CONSTRAINT "chk_fact_anomalies_anomaly_type"
  CHECK (
    "anomaly_type" IS NULL OR
    "anomaly_type" IN (
      'cost_spike',
      'cost_drop',
      'service_cost_anomaly',
      'region_cost_anomaly',
      'sub_account_cost_anomaly',
      'tag_cost_anomaly',
      'usage_spike',
      'usage_drop',
      'usage_mismatch',
      'idle_cost',
      'data_transfer_spike',
      'storage_growth',
      'pricing_rate_change',
      'commitment_coverage_drop',
      'recurring_pattern_break',
      'change_event_correlated',
      'forecast_deviation',
      'resource_cost_anomaly',
      'spike',
      'drop'
    )
  );

ALTER TABLE "fact_anomalies"
  ADD CONSTRAINT "chk_fact_anomalies_baseline_type"
  CHECK (
    "baseline_type" IS NULL OR
    "baseline_type" IN ('rolling_7d', 'same_weekday_4w', 'hourly_pattern', 'same_hour_7d', 'rolling_median')
  );
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE "fact_anomalies"
  DROP CONSTRAINT IF EXISTS "chk_fact_anomalies_anomaly_type",
  DROP CONSTRAINT IF EXISTS "chk_fact_anomalies_baseline_type";

ALTER TABLE "fact_anomalies"
  ADD CONSTRAINT "chk_fact_anomalies_anomaly_type"
  CHECK (
    "anomaly_type" IS NULL OR
    "anomaly_type" IN ('spike', 'drop', 'usage_mismatch', 'idle_cost')
  );

ALTER TABLE "fact_anomalies"
  ADD CONSTRAINT "chk_fact_anomalies_baseline_type"
  CHECK (
    "baseline_type" IS NULL OR
    "baseline_type" IN ('rolling_7d', 'same_weekday_4w', 'hourly_pattern')
  );
`);
  },
};

export default migration;
