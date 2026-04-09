/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE fact_recommendations
  ADD COLUMN IF NOT EXISTS cloud_connection_id UUID NULL,
  ADD COLUMN IF NOT EXISTS billing_source_id BIGINT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_fact_recommendations_cloud_connection_id'
  ) THEN
    ALTER TABLE fact_recommendations
      ADD CONSTRAINT fk_fact_recommendations_cloud_connection_id
      FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_fact_recommendations_billing_source_id'
  ) THEN
    ALTER TABLE fact_recommendations
      ADD CONSTRAINT fk_fact_recommendations_billing_source_id
      FOREIGN KEY (billing_source_id) REFERENCES billing_sources(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fact_recommendations_cloud_connection_id
  ON fact_recommendations(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_fact_recommendations_billing_source_id
  ON fact_recommendations(billing_source_id);
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS idx_fact_recommendations_cloud_connection_id;
DROP INDEX IF EXISTS idx_fact_recommendations_billing_source_id;

ALTER TABLE fact_recommendations
  DROP CONSTRAINT IF EXISTS fk_fact_recommendations_cloud_connection_id;
ALTER TABLE fact_recommendations
  DROP CONSTRAINT IF EXISTS fk_fact_recommendations_billing_source_id;

ALTER TABLE fact_recommendations
  DROP COLUMN IF EXISTS cloud_connection_id;
ALTER TABLE fact_recommendations
  DROP COLUMN IF EXISTS billing_source_id;
`);
  },
};

export default migration;
