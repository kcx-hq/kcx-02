/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS idx_fact_anomalies_account_name;

ALTER TABLE fact_anomalies
  DROP COLUMN IF EXISTS account_name,
  DROP COLUMN IF EXISTS service,
  DROP COLUMN IF EXISTS region;
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE fact_anomalies
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS service text,
  ADD COLUMN IF NOT EXISTS region text;

CREATE INDEX IF NOT EXISTS idx_fact_anomalies_account_name ON fact_anomalies(account_name);
`);
  },
};

export default migration;
