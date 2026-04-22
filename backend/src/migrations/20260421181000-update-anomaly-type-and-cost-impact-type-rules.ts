/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
UPDATE fact_anomalies
SET anomaly_type = 'sudden_cost_spike'
WHERE anomaly_type = 'spike';

UPDATE fact_anomalies
SET anomaly_type = 'new_high_cost_instance'
WHERE anomaly_type = 'cost_spike';

UPDATE fact_anomalies
SET cost_impact_type = CASE
  WHEN COALESCE(delta_cost, 0) < 0 THEN 'decrease'
  ELSE 'increase'
END
WHERE cost_impact_type IS NULL
   OR cost_impact_type NOT IN ('increase', 'decrease');

ALTER TABLE fact_anomalies
  DROP CONSTRAINT IF EXISTS chk_fact_anomalies_anomaly_type,
  DROP CONSTRAINT IF EXISTS chk_fact_anomalies_cost_impact_type;

ALTER TABLE fact_anomalies
  ADD CONSTRAINT chk_fact_anomalies_anomaly_type
  CHECK (
    anomaly_type IS NULL OR
    anomaly_type IN (
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
      'drop',
      'sudden_cost_spike',
      'new_high_cost_instance',
      'cpu_spike_anomaly'
    )
  );

ALTER TABLE fact_anomalies
  ADD CONSTRAINT chk_fact_anomalies_cost_impact_type
  CHECK (
    cost_impact_type IS NULL OR
    cost_impact_type IN ('increase', 'decrease')
  );
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
UPDATE fact_anomalies
SET anomaly_type = 'spike'
WHERE anomaly_type = 'sudden_cost_spike';

UPDATE fact_anomalies
SET anomaly_type = 'cost_spike'
WHERE anomaly_type = 'new_high_cost_instance';

ALTER TABLE fact_anomalies
  DROP CONSTRAINT IF EXISTS chk_fact_anomalies_cost_impact_type,
  DROP CONSTRAINT IF EXISTS chk_fact_anomalies_anomaly_type;

ALTER TABLE fact_anomalies
  ADD CONSTRAINT chk_fact_anomalies_anomaly_type
  CHECK (
    anomaly_type IS NULL OR
    anomaly_type IN (
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
`);
  },
};

export default migration;
