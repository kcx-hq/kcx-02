import type { QueryInterface } from "sequelize";

const NEW_ALLOWED_TYPES = [
  "sudden_cost_spike",
  "new_high_cost_instance",
  "cost_drop",
  "S3 Storage Cost Spike",
  "S3 Data Transfer Spike",
  "S3 Request Cost Spike",
  "S3 Storage Growth Anomaly",
] as const;

const LEGACY_ALLOWED_TYPES = [
  "sudden_cost_spike",
  "new_high_cost_instance",
  "cost_drop",
] as const;

const toInList = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(", ");

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
      ALTER TABLE fact_anomalies
      DROP CONSTRAINT IF EXISTS chk_fact_anomalies_anomaly_type;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE fact_anomalies
      ADD CONSTRAINT chk_fact_anomalies_anomaly_type
      CHECK (anomaly_type IS NULL OR anomaly_type IN (${toInList(NEW_ALLOWED_TYPES)}));
    `);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
      ALTER TABLE fact_anomalies
      DROP CONSTRAINT IF EXISTS chk_fact_anomalies_anomaly_type;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE fact_anomalies
      ADD CONSTRAINT chk_fact_anomalies_anomaly_type
      CHECK (anomaly_type IS NULL OR anomaly_type IN (${toInList(LEGACY_ALLOWED_TYPES)}));
    `);
  },
};

export default migration;

