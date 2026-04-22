/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE fact_anomalies
  DROP COLUMN IF EXISTS cost;
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE fact_anomalies
  ADD COLUMN IF NOT EXISTS cost numeric(18, 6);
`);
  },
};

export default migration;
