import type { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    UPDATE s3_cost_daily
    SET bucket_name = NULL
    WHERE bucket_name IS NOT NULL
      AND (
        lower(bucket_name) IN (
          'unattributed',
          'aws.s3',
          'lambda',
          'amazon s3',
          's3',
          'credits / adjustments'
        )
        OR lower(bucket_name) LIKE 'arn:aws:s3:%:storage-lens/%'
      );
  `);
}

export async function down(): Promise<void> {
  // Irreversible data cleanup.
}

