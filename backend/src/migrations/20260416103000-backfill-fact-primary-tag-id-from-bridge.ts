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

const migration = {
  async up(queryInterface) {
    const hasFacts = await hasTable(queryInterface, "fact_cost_line_items");
    const hasBridge = await hasTable(queryInterface, "fact_cost_line_item_tags");
    if (!hasFacts || !hasBridge) return;

    await queryInterface.sequelize.query(`
INSERT INTO fact_cost_line_item_tags (fact_id, tag_id, tenant_id, provider_id, created_at)
SELECT f.id, f.tag_id, f.tenant_id, f.provider_id, NOW()
FROM fact_cost_line_items f
WHERE f.tag_id IS NOT NULL
ON CONFLICT (fact_id, tag_id) DO NOTHING;
`);
  },

  async down() {
    // No-op by design: bridge links may already include multi-tag links from ingestion.
  },
};

export default migration;

