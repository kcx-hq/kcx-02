import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
ALTER TABLE s3_storage_lens_daily
  ADD COLUMN IF NOT EXISTS ingestion_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS report_object_key TEXT,
  ADD COLUMN IF NOT EXISTS report_generated_date DATE;

CREATE INDEX IF NOT EXISTS idx_s3_storage_lens_daily_ingestion_source
  ON s3_storage_lens_daily(ingestion_source);

CREATE INDEX IF NOT EXISTS idx_s3_storage_lens_daily_report_generated_date
  ON s3_storage_lens_daily(report_generated_date);
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS idx_s3_storage_lens_daily_ingestion_source;
DROP INDEX IF EXISTS idx_s3_storage_lens_daily_report_generated_date;

ALTER TABLE s3_storage_lens_daily
  DROP COLUMN IF EXISTS ingestion_source,
  DROP COLUMN IF EXISTS report_object_key,
  DROP COLUMN IF EXISTS report_generated_date;
`);
  },
};

export default migration;

