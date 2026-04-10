/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE fact_recommendations
  ALTER COLUMN aws_region_code DROP NOT NULL,
  ALTER COLUMN resource_id DROP NOT NULL,
  ALTER COLUMN source_system SET DEFAULT 'AWS_SAVINGS_PLANS_API';
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
UPDATE fact_recommendations
SET aws_region_code = 'unknown'
WHERE aws_region_code IS NULL;

UPDATE fact_recommendations
SET resource_id = 'unknown'
WHERE resource_id IS NULL;

ALTER TABLE fact_recommendations
  ALTER COLUMN aws_region_code SET NOT NULL,
  ALTER COLUMN resource_id SET NOT NULL,
  ALTER COLUMN source_system SET DEFAULT 'AWS_COMPUTE_OPTIMIZER';
`);
  },
};

export default migration;
