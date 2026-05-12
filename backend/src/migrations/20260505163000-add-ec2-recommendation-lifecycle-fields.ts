import type { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE fact_recommendations
      ADD COLUMN IF NOT EXISTS status_reason TEXT NULL,
      ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS status_updated_by TEXT NULL;
  `);

  await queryInterface.sequelize.query(`
    UPDATE fact_recommendations
    SET status = 'OPEN'
    WHERE status IS NULL OR LENGTH(TRIM(status)) = 0;
  `);

  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS recommendation_status_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      recommendation_id BIGINT NOT NULL,
      previous_status TEXT NULL,
      new_status TEXT NOT NULL,
      reason TEXT NULL,
      snoozed_until TIMESTAMPTZ NULL,
      changed_by TEXT NULL,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_recommendation_status_events_tenant_recommendation
      ON recommendation_status_events (tenant_id, recommendation_id, changed_at DESC);
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_recommendation_status_events_tenant_recommendation;
  `);
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS recommendation_status_events;
  `);
  await queryInterface.sequelize.query(`
    ALTER TABLE fact_recommendations
      DROP COLUMN IF EXISTS status_reason,
      DROP COLUMN IF EXISTS snoozed_until,
      DROP COLUMN IF EXISTS status_updated_at,
      DROP COLUMN IF EXISTS status_updated_by;
  `);
}
