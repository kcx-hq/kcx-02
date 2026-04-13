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
    const columns = await queryInterface.describeTable(tableName);
    return Boolean(columns[columnName]);
  } catch {
    return false;
  }
};

const dropIndexIfExists = async (queryInterface, tableName, indexName) => {
  try {
    const indexes = await queryInterface.showIndex(tableName);
    if (!indexes.some((idx) => idx.name === indexName)) return;
    await queryInterface.removeIndex(tableName, indexName);
  } catch {
    // ignore
  }
};

const ensureIndex = async (queryInterface, tableName, indexName, fields) => {
  const indexes = await queryInterface.showIndex(tableName);
  if (indexes.some((idx) => idx.name === indexName)) return;
  await queryInterface.addIndex(tableName, fields, { name: indexName });
};

const migration = {
  async up(queryInterface, Sequelize) {
    if (!(await hasTable(queryInterface, "users"))) return;

    if (!(await hasColumn(queryInterface, "users", "invited_by_user_id"))) {
      await queryInterface.addColumn("users", "invited_by_user_id", {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    if (!(await hasColumn(queryInterface, "users", "invited_at"))) {
      await queryInterface.addColumn("users", "invited_at", {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!(await hasColumn(queryInterface, "users", "approved_by_user_id"))) {
      await queryInterface.addColumn("users", "approved_by_user_id", {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    if (!(await hasColumn(queryInterface, "users", "approved_at"))) {
      await queryInterface.addColumn("users", "approved_at", {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }

    await ensureIndex(queryInterface, "users", "users_tenant_id_status", ["tenant_id", "status"]);
    await ensureIndex(queryInterface, "users", "users_tenant_id_role", ["tenant_id", "role"]);
  },

  async down(queryInterface) {
    if (!(await hasTable(queryInterface, "users"))) return;

    await dropIndexIfExists(queryInterface, "users", "users_tenant_id_role");
    await dropIndexIfExists(queryInterface, "users", "users_tenant_id_status");

    if (await hasColumn(queryInterface, "users", "approved_at")) {
      await queryInterface.removeColumn("users", "approved_at");
    }

    if (await hasColumn(queryInterface, "users", "approved_by_user_id")) {
      await queryInterface.removeColumn("users", "approved_by_user_id");
    }

    if (await hasColumn(queryInterface, "users", "invited_at")) {
      await queryInterface.removeColumn("users", "invited_at");
    }

    if (await hasColumn(queryInterface, "users", "invited_by_user_id")) {
      await queryInterface.removeColumn("users", "invited_by_user_id");
    }
  },
};

export default migration;

