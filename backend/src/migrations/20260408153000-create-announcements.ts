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

const ensureIndex = async (queryInterface, tableName, indexName, fields) => {
  const indexes = await queryInterface.showIndex(tableName);
  if (indexes.some((idx) => idx.name === indexName)) return;
  await queryInterface.addIndex(tableName, fields, { name: indexName });
};

const migration = {
  async up(queryInterface, Sequelize) {
    if (!(await hasTable(queryInterface, "announcements"))) {
      await queryInterface.createTable("announcements", {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        title: { type: Sequelize.STRING(255), allowNull: false },
        body: { type: Sequelize.TEXT, allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "DRAFT" },
        audience: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "ALL" },
        audience_scope: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "ALL" },
        audience_client_ids: { type: Sequelize.ARRAY(Sequelize.UUID), allowNull: true },
        audience_tier: { type: Sequelize.STRING(20), allowNull: true },
        publish_at: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
        expires_at: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
        created_by_admin_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "AdminUsers", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      });
    }

    await ensureIndex(queryInterface, "announcements", "idx_announcements_status", ["status"]);
    await ensureIndex(queryInterface, "announcements", "idx_announcements_publish_at", ["publish_at"]);
    await ensureIndex(queryInterface, "announcements", "idx_announcements_updated_at", ["updated_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("announcements");
  },
};

export default migration;
