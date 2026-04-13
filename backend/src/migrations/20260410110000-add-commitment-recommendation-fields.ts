/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE fact_recommendations
  ADD COLUMN IF NOT EXISTS recommended_hourly_commitment DECIMAL(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recommended_payment_option VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS recommended_term VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS commitment_plan_type VARCHAR(50) NULL;
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE fact_recommendations
  DROP COLUMN IF EXISTS commitment_plan_type,
  DROP COLUMN IF EXISTS recommended_term,
  DROP COLUMN IF EXISTS recommended_payment_option,
  DROP COLUMN IF EXISTS recommended_hourly_commitment;
`);
  },
};

export default migration;
