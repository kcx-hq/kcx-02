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
  async up(queryInterface, Sequelize) {
    if (await hasTable(queryInterface, "fact_cost_line_item_tags")) {
      return;
    }

    await queryInterface.createTable("fact_cost_line_item_tags", {
      fact_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "fact_cost_line_items", key: "id" },
        onDelete: "CASCADE",
      },
      tag_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "dim_tag", key: "id" },
        onDelete: "CASCADE",
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "tenants", key: "id" },
        onDelete: "CASCADE",
      },
      provider_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "cloud_providers", key: "id" },
        onDelete: "RESTRICT",
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addConstraint("fact_cost_line_item_tags", {
      type: "primary key",
      fields: ["fact_id", "tag_id"],
      name: "pk_fact_cost_line_item_tags",
    });

    await queryInterface.addIndex("fact_cost_line_item_tags", ["tag_id"], {
      name: "idx_fact_cost_line_item_tags_tag_id",
    });

    await queryInterface.addIndex("fact_cost_line_item_tags", ["tenant_id", "provider_id"], {
      name: "idx_fact_cost_line_item_tags_tenant_provider",
    });
  },

  async down(queryInterface) {
    if (!(await hasTable(queryInterface, "fact_cost_line_item_tags"))) {
      return;
    }

    await queryInterface.dropTable("fact_cost_line_item_tags");
  },
};

export default migration;

