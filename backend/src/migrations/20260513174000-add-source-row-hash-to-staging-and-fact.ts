import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
ALTER TABLE IF EXISTS staging_cost_line_items
  ADD COLUMN IF NOT EXISTS source_row_hash TEXT;

ALTER TABLE IF EXISTS fact_cost_line_items
  ADD COLUMN IF NOT EXISTS source_row_hash TEXT;
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
ALTER TABLE IF EXISTS fact_cost_line_items
  DROP COLUMN IF EXISTS source_row_hash;

ALTER TABLE IF EXISTS staging_cost_line_items
  DROP COLUMN IF EXISTS source_row_hash;
`);
  },
};

export default migration;

