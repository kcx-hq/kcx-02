const hasTable = async (queryInterface: any, tableName: string) => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const migration = {
  async up(queryInterface: any, Sequelize: any) {
    if (await hasTable(queryInterface, "dim_service")) {
      return;
    }

    await queryInterface.createTable("dim_service", {
      id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      provider_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "cloud_providers", key: "id" },
      },
      service_name: { type: Sequelize.STRING(255), allowNull: false },
      service_category: { type: Sequelize.STRING(255), allowNull: true },
      service_subcategory: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addConstraint("dim_service", {
      type: "unique",
      fields: ["provider_id", "service_name", "service_category", "service_subcategory"],
      name: "uq_dim_service_provider_name_category_subcategory",
    });

    await queryInterface.addIndex("dim_service", ["provider_id"], { name: "idx_dim_service_provider_id" });
  },

  async down(queryInterface: any) {
    if (!(await hasTable(queryInterface, "dim_service"))) {
      return;
    }
    await queryInterface.dropTable("dim_service");
  },
};

export default migration;

