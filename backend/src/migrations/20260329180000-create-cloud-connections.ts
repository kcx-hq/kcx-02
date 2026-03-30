const hasTable = async (queryInterface: any, tableName: string) => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const ensureIndex = async (
  queryInterface: any,
  tableName: string,
  indexName: string,
  fields: string[],
  options?: { unique?: boolean },
) => {
  const indexes = await queryInterface.showIndex(tableName);
  if (indexes.some((idx: any) => idx.name === indexName)) return;
  await queryInterface.addIndex(tableName, fields, { name: indexName, ...(options ?? {}) });
};

const migration = {
  async up(queryInterface: any, Sequelize: any) {
    if (!(await hasTable(queryInterface, "cloud_connections"))) {
      await queryInterface.createTable("cloud_connections", {
        id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
        client_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "Clients", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        connection_name: { type: Sequelize.STRING, allowNull: false },
        provider: { type: Sequelize.STRING, allowNull: false },
        status: { type: Sequelize.STRING, allowNull: false, defaultValue: "draft" },
        account_type: { type: Sequelize.STRING, allowNull: false, defaultValue: "payer" },
        created_at: { allowNull: false, type: Sequelize.DATE },
        updated_at: { allowNull: false, type: Sequelize.DATE },
      });
    }

    await ensureIndex(queryInterface, "cloud_connections", "cloud_connections_client_id", ["client_id"]);
    await ensureIndex(
      queryInterface,
      "cloud_connections",
      "cloud_connections_client_connection_name_unique",
      ["client_id", "connection_name"],
      { unique: true },
    );
  },

  async down(queryInterface: any) {
    await queryInterface.dropTable("cloud_connections");
  },
};

export default migration;

