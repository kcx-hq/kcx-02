import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
ALTER TABLE IF EXISTS fact_cost_line_items
  ADD COLUMN IF NOT EXISTS tag_id BIGINT;

ALTER TABLE IF EXISTS staging_cost_line_items
  ADD COLUMN IF NOT EXISTS tag_id BIGINT,
  ADD COLUMN IF NOT EXISTS tag_ids_json JSONB;
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
ALTER TABLE IF EXISTS staging_cost_line_items
  DROP COLUMN IF EXISTS tag_ids_json;
`);
  },
};

export default migration;

