/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE fact_anomalies
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS duration integer,
  ADD COLUMN IF NOT EXISTS cost_impact_type varchar(50),
  ADD COLUMN IF NOT EXISTS cost_impact numeric(18, 6),
  ADD COLUMN IF NOT EXISTS cost_impact_percentage numeric(10, 4);

UPDATE fact_anomalies
SET
  start_date = COALESCE(start_date, usage_date),
  duration = COALESCE(duration, 1),
  cost_impact_type = COALESCE(cost_impact_type, anomaly_type),
  cost_impact = COALESCE(cost_impact, delta_cost),
  cost_impact_percentage = COALESCE(cost_impact_percentage, delta_percent);

CREATE INDEX IF NOT EXISTS idx_fact_anomalies_start_date ON fact_anomalies(start_date);
CREATE INDEX IF NOT EXISTS idx_fact_anomalies_cost_impact_type ON fact_anomalies(cost_impact_type);
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS idx_fact_anomalies_cost_impact_type;
DROP INDEX IF EXISTS idx_fact_anomalies_start_date;

ALTER TABLE fact_anomalies
  DROP COLUMN IF EXISTS start_date,
  DROP COLUMN IF EXISTS duration,
  DROP COLUMN IF EXISTS cost_impact_type,
  DROP COLUMN IF EXISTS cost_impact,
  DROP COLUMN IF EXISTS cost_impact_percentage;
`);
  },
};

export default migration;
