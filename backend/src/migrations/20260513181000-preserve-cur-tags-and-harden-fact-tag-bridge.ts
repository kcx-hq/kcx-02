import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
ALTER TABLE IF EXISTS staging_cost_line_items
  ADD COLUMN IF NOT EXISTS tags_json JSONB;

ALTER TABLE IF EXISTS fact_cost_line_items
  ADD COLUMN IF NOT EXISTS tags_json JSONB,
  ADD COLUMN IF NOT EXISTS tag_ids_json JSONB;

DO $$
BEGIN
  IF to_regclass('public.fact_cost_line_item_tags') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'uq_fact_cost_line_item_tags_fact_id_tag_id'
    ) THEN
      ALTER TABLE fact_cost_line_item_tags
        ADD CONSTRAINT uq_fact_cost_line_item_tags_fact_id_tag_id
        UNIQUE (fact_id, tag_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fk_fact_cost_line_item_tags_fact_id'
    ) THEN
      ALTER TABLE fact_cost_line_item_tags
        ADD CONSTRAINT fk_fact_cost_line_item_tags_fact_id
        FOREIGN KEY (fact_id)
        REFERENCES fact_cost_line_items(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DO $$
BEGIN
  IF to_regclass('public.fact_cost_line_item_tags') IS NOT NULL THEN
    ALTER TABLE fact_cost_line_item_tags
      DROP CONSTRAINT IF EXISTS fk_fact_cost_line_item_tags_fact_id;

    ALTER TABLE fact_cost_line_item_tags
      DROP CONSTRAINT IF EXISTS uq_fact_cost_line_item_tags_fact_id_tag_id;
  END IF;
END $$;

ALTER TABLE IF EXISTS fact_cost_line_items
  DROP COLUMN IF EXISTS tag_ids_json,
  DROP COLUMN IF EXISTS tags_json;

ALTER TABLE IF EXISTS staging_cost_line_items
  DROP COLUMN IF EXISTS tags_json;
`);
  },
};

export default migration;

