/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE fact_recommendations
  ADD COLUMN IF NOT EXISTS resource_type VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS idle_reason VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS idle_observation_value VARCHAR(255) NULL;

CREATE INDEX IF NOT EXISTS idx_fact_recommendations_category_status
  ON fact_recommendations(tenant_id, category, status);

CREATE INDEX IF NOT EXISTS idx_fact_recommendations_idle_reason
  ON fact_recommendations(idle_reason);

CREATE INDEX IF NOT EXISTS idx_fact_recommendations_resource_type
  ON fact_recommendations(resource_type);
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS idx_fact_recommendations_resource_type;
DROP INDEX IF EXISTS idx_fact_recommendations_idle_reason;
DROP INDEX IF EXISTS idx_fact_recommendations_category_status;

ALTER TABLE fact_recommendations
  DROP COLUMN IF EXISTS idle_observation_value;
ALTER TABLE fact_recommendations
  DROP COLUMN IF EXISTS idle_reason;
ALTER TABLE fact_recommendations
  DROP COLUMN IF EXISTS resource_type;
`);
  },
};

export default migration;
