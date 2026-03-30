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
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    if (await hasTable(queryInterface, "Clients")) {
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS "Clients" CASCADE;');
    }
    if (await hasTable(queryInterface, "Users")) {
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS "Users" CASCADE;');
    }

    if (!(await hasTable(queryInterface, "tenants"))) {
      await queryInterface.createTable("tenants", {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        name: { type: Sequelize.STRING(150), allowNull: false },
        slug: { type: Sequelize.STRING(150), allowNull: false, unique: true },
        status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "active" },
        created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("NOW()") },
        updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("NOW()") },
      });
    }

    if (!(await hasTable(queryInterface, "users"))) {
      await queryInterface.createTable("users", {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        tenant_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: "tenants", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        full_name: { type: Sequelize.STRING(150), allowNull: false },
        email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
        role: { type: Sequelize.STRING(30), allowNull: false },
        status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "active" },
        created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("NOW()") },
        updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("NOW()") },
      });
    }
  },

  async down(queryInterface: any, Sequelize: any) {
    if (await hasTable(queryInterface, "users")) {
      await queryInterface.dropTable("users");
    }
    if (await hasTable(queryInterface, "tenants")) {
      await queryInterface.dropTable("tenants");
    }

    if (!(await hasTable(queryInterface, "Clients"))) {
      await queryInterface.createTable("Clients", {
        id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
        firstName: { type: Sequelize.STRING, allowNull: false },
        lastName: { type: Sequelize.STRING, allowNull: false },
        email: { type: Sequelize.STRING, allowNull: false, unique: true },
        passwordHash: { type: Sequelize.STRING, allowNull: false },
        companyName: { type: Sequelize.STRING, allowNull: true },
        heardAboutUs: { type: Sequelize.STRING, allowNull: true, defaultValue: null },
        role: { type: Sequelize.STRING, allowNull: false, defaultValue: "client" },
        status: { type: Sequelize.STRING, allowNull: false, defaultValue: "active" },
        source: { type: Sequelize.STRING, allowNull: false, defaultValue: "schedule_demo" },
        createdAt: { allowNull: false, type: Sequelize.DATE },
        updatedAt: { allowNull: false, type: Sequelize.DATE },
      });
    }
  },
};

export default migration;

