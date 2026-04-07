// @ts-nocheck
const OLD_MANUAL_INDEX = "uq_manual_cloud_connections_tenant_aws_account_id";
const GLOBAL_ACCOUNT_INDEX = "uq_cloud_integrations_provider_cloud_account_id";

const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY provider_id, cloud_account_id
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
          ) AS row_number
        FROM cloud_integrations
        WHERE cloud_account_id IS NOT NULL
      )
      DELETE FROM cloud_integrations ci
      USING ranked r
      WHERE ci.id = r.id
        AND r.row_number > 1;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS ${OLD_MANUAL_INDEX};
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${GLOBAL_ACCOUNT_INDEX}
      ON cloud_integrations (provider_id, cloud_account_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS ${GLOBAL_ACCOUNT_INDEX};
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${OLD_MANUAL_INDEX}
      ON manual_cloud_connections (tenant_id, aws_account_id);
    `);
  },
};

export default migration;
