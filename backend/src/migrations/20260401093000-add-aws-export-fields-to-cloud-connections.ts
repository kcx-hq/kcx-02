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

const migration = {
  async up(queryInterface, Sequelize) {
    if (!(await hasTable(queryInterface, "cloud_connections"))) return;

    if (!(await hasColumn(queryInterface, "cloud_connections", "export_name"))) {
      await queryInterface.addColumn("cloud_connections", "export_name", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    if (!(await hasColumn(queryInterface, "cloud_connections", "export_bucket"))) {
      await queryInterface.addColumn("cloud_connections", "export_bucket", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    if (!(await hasColumn(queryInterface, "cloud_connections", "export_prefix"))) {
      await queryInterface.addColumn("cloud_connections", "export_prefix", {
        type: Sequelize.STRING(1000),
        allowNull: true,
      });
    }

    if (!(await hasColumn(queryInterface, "cloud_connections", "export_region"))) {
      await queryInterface.addColumn("cloud_connections", "export_region", {
        type: Sequelize.STRING(50),
        allowNull: true,
      });
    }

    if (!(await hasColumn(queryInterface, "cloud_connections", "export_arn"))) {
      await queryInterface.addColumn("cloud_connections", "export_arn", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    if (!(await hasTable(queryInterface, "cloud_connections"))) return;

    if (await hasColumn(queryInterface, "cloud_connections", "export_arn")) {
      await queryInterface.removeColumn("cloud_connections", "export_arn");
    }
    if (await hasColumn(queryInterface, "cloud_connections", "export_region")) {
      await queryInterface.removeColumn("cloud_connections", "export_region");
    }
    if (await hasColumn(queryInterface, "cloud_connections", "export_prefix")) {
      await queryInterface.removeColumn("cloud_connections", "export_prefix");
    }
    if (await hasColumn(queryInterface, "cloud_connections", "export_bucket")) {
      await queryInterface.removeColumn("cloud_connections", "export_bucket");
    }
    if (await hasColumn(queryInterface, "cloud_connections", "export_name")) {
      await queryInterface.removeColumn("cloud_connections", "export_name");
    }
  },
};

export default migration;




