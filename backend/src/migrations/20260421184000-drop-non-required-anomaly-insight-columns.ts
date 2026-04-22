/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE fact_anomalies
  DROP CONSTRAINT IF EXISTS chk_fact_anomalies_cost_impact_type;

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

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE fact_anomalies
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS duration integer,
  ADD COLUMN IF NOT EXISTS cost_impact_type varchar(50),
  ADD COLUMN IF NOT EXISTS cost_impact numeric(18, 6),
  ADD COLUMN IF NOT EXISTS cost_impact_percentage numeric(10, 4);

CREATE INDEX IF NOT EXISTS idx_fact_anomalies_start_date ON fact_anomalies(start_date);
CREATE INDEX IF NOT EXISTS idx_fact_anomalies_cost_impact_type ON fact_anomalies(cost_impact_type);

ALTER TABLE fact_anomalies
  ADD CONSTRAINT chk_fact_anomalies_cost_impact_type
  CHECK (
    cost_impact_type IS NULL OR
    cost_impact_type IN ('increase', 'decrease')
  );
`);
  },
};

export default migration;
