/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const TABLE_NAME = "fact_recommendation_actions";

const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE ${TABLE_NAME}
  ADD COLUMN IF NOT EXISTS resource_id VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS resource_type VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS recommendation_type VARCHAR(80) NULL;

CREATE INDEX IF NOT EXISTS idx_fact_recommendation_actions_action_status_requested
  ON ${TABLE_NAME} (action_type, status, requested_at DESC);
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS idx_fact_recommendation_actions_action_status_requested;

ALTER TABLE ${TABLE_NAME}
  DROP COLUMN IF EXISTS recommendation_type,
  DROP COLUMN IF EXISTS resource_type,
  DROP COLUMN IF EXISTS resource_id;
`);
  },
};

export default migration;

