// @ts-nocheck
const OLD_MANUAL_INDEX = "uq_manual_cloud_connections_tenant_aws_account_id";
const GLOBAL_ACCOUNT_INDEX = "uq_cloud_integrations_provider_cloud_account_id";

const migration = {
  async up(queryInterface) {
    const [duplicates] = await queryInterface.sequelize.query(`
      SELECT provider_id, cloud_account_id, COUNT(*)::int AS duplicate_count
      FROM cloud_integrations
      WHERE cloud_account_id IS NOT NULL
      GROUP BY provider_id, cloud_account_id
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
      LIMIT 20;
    `);

    if (Array.isArray(duplicates) && duplicates.length > 0) {
      const preview = duplicates
        .map((row) => `${row.provider_id}:${row.cloud_account_id} (${row.duplicate_count})`)
        .join(", ");

      throw new Error(
        `Cannot add ${GLOBAL_ACCOUNT_INDEX} because duplicate cloud accounts already exist in cloud_integrations. Resolve duplicates first. Sample rows: ${preview}`,
      );
    }

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
