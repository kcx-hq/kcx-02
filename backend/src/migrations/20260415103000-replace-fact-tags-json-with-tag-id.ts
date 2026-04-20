/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const hasTable = async (queryInterface, tableName) => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const hasColumn = async (queryInterface, tableName, columnName) => {
  try {
    const table = await queryInterface.describeTable(tableName);
    return Boolean(table?.[columnName]);
  } catch {
    return false;
  }
};

const migration = {
  async up(queryInterface, Sequelize) {
    if (!(await hasTable(queryInterface, "fact_cost_line_items"))) {
      return;
    }

    if (await hasColumn(queryInterface, "fact_cost_line_items", "tag_id")) {
      // noop
    } else {
      await queryInterface.addColumn("fact_cost_line_items", "tag_id", {
        type: Sequelize.BIGINT,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_fact_cost_line_items_tag_id'
  ) THEN
    ALTER TABLE fact_cost_line_items
      ADD CONSTRAINT fk_fact_cost_line_items_tag_id
      FOREIGN KEY (tag_id) REFERENCES dim_tag(id) ON DELETE SET NULL;
  END IF;
END
$$;
`);

    await queryInterface.sequelize.query(`
CREATE INDEX IF NOT EXISTS idx_fact_cost_line_items_tag_id
  ON fact_cost_line_items(tag_id);
`);

    if (await hasColumn(queryInterface, "fact_cost_line_items", "tags_json")) {
      await queryInterface.removeColumn("fact_cost_line_items", "tags_json");
    }
  },

  async down(queryInterface, Sequelize) {
    if (!(await hasTable(queryInterface, "fact_cost_line_items"))) {
      return;
    }

    if (!(await hasColumn(queryInterface, "fact_cost_line_items", "tags_json"))) {
      await queryInterface.addColumn("fact_cost_line_items", "tags_json", {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
ALTER TABLE fact_cost_line_items
  DROP CONSTRAINT IF EXISTS fk_fact_cost_line_items_tag_id;
`);

    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS idx_fact_cost_line_items_tag_id;
`);

    if (await hasColumn(queryInterface, "fact_cost_line_items", "tag_id")) {
      await queryInterface.removeColumn("fact_cost_line_items", "tag_id");
    }
  },
};

export default migration;

