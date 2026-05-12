import type { QueryInterface } from "sequelize";

const INDEX_NAME = "idx_fact_recommendations_ec2_identity_status";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ${INDEX_NAME}
      ON fact_recommendations (
        tenant_id,
        cloud_connection_id,
        billing_source_id,
        resource_id,
        recommendation_type,
        status
      )
      WHERE category = 'EC2' AND source_system = 'KCX_EC2_OPTIMIZATION';
    `);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS ${INDEX_NAME};
    `);
  },
};

export default migration;
