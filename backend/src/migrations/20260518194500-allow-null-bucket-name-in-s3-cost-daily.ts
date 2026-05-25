import type { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE s3_cost_daily
    ALTER COLUMN bucket_name DROP NOT NULL;
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE s3_cost_daily
    ALTER COLUMN bucket_name SET NOT NULL;
  `);
}

