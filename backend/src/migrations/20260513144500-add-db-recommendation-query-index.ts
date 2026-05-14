import type { QueryInterface } from "sequelize";

const INDEX_NAME = "idx_fact_recommendations_tenant_conn_category_status";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ${INDEX_NAME}
      ON fact_recommendations (
        tenant_id,
        cloud_connection_id,
        category,
        status,
        updated_at DESC
      );
    `);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS ${INDEX_NAME};
    `);
  },
};

export default migration;
