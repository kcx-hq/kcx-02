import type { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE fact_recommendations
      ADD COLUMN IF NOT EXISTS metadata_json JSONB,
      ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_fact_recommendations_ec2_v1_lookup
      ON fact_recommendations (
        tenant_id,
        source_system,
        category,
        recommendation_type,
        resource_type,
        resource_id
      );
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_fact_recommendations_ec2_v1_lookup;
  `);

  await queryInterface.sequelize.query(`
    ALTER TABLE fact_recommendations
      DROP COLUMN IF EXISTS metadata_json,
      DROP COLUMN IF EXISTS detected_at,
      DROP COLUMN IF EXISTS last_seen_at;
  `);
}
