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
    if (await hasTable(queryInterface, "dim_billing_account")) {
      return;
    }

    await queryInterface.createTable("dim_billing_account", {
      id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
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
      },
      billing_account_id: { type: Sequelize.STRING(100), allowNull: false },
      billing_account_name: { type: Sequelize.STRING(255), allowNull: true },
      billing_currency: { type: Sequelize.STRING(20), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addConstraint("dim_billing_account", {
      type: "unique",
      fields: ["tenant_id", "provider_id", "billing_account_id"],
      name: "uq_dim_billing_account_tenant_provider_account_id",
    });

    await queryInterface.addIndex("dim_billing_account", ["tenant_id", "provider_id"], {
      name: "idx_dim_billing_account_tenant_provider",
    });
  },

  async down(queryInterface: any) {
    if (!(await hasTable(queryInterface, "dim_billing_account"))) {
      return;
    }
    await queryInterface.dropTable("dim_billing_account");
  },
};

export default migration;

