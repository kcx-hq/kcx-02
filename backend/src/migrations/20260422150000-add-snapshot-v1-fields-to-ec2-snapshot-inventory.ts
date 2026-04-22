import type { DataTypes, QueryInterface } from "sequelize";

type MigrationDataTypes = typeof DataTypes;

const TABLE_NAME = "ec2_snapshot_inventory_snapshots";

const hasTable = async (queryInterface: QueryInterface, tableName: string): Promise<boolean> => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const hasColumn = async (queryInterface: QueryInterface, tableName: string, columnName: string): Promise<boolean> => {
  try {
    const table = await queryInterface.describeTable(tableName);
    return Boolean(table?.[columnName]);
  } catch {
    return false;
  }
};

const migration = {
  async up(queryInterface: QueryInterface, Sequelize: MigrationDataTypes): Promise<void> {
    if (!(await hasTable(queryInterface, TABLE_NAME))) return;

    if (!(await hasColumn(queryInterface, TABLE_NAME, "storage_tier"))) {
      await queryInterface.addColumn(TABLE_NAME, "storage_tier", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!(await hasColumn(queryInterface, TABLE_NAME, "encrypted"))) {
      await queryInterface.addColumn(TABLE_NAME, "encrypted", {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      });
    }

    if (!(await hasColumn(queryInterface, TABLE_NAME, "kms_key_id"))) {
      await queryInterface.addColumn(TABLE_NAME, "kms_key_id", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!(await hasColumn(queryInterface, TABLE_NAME, "progress"))) {
      await queryInterface.addColumn(TABLE_NAME, "progress", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    if (!(await hasTable(queryInterface, TABLE_NAME))) return;

    if (await hasColumn(queryInterface, TABLE_NAME, "progress")) {
      await queryInterface.removeColumn(TABLE_NAME, "progress");
    }

    if (await hasColumn(queryInterface, TABLE_NAME, "kms_key_id")) {
      await queryInterface.removeColumn(TABLE_NAME, "kms_key_id");
    }

    if (await hasColumn(queryInterface, TABLE_NAME, "encrypted")) {
      await queryInterface.removeColumn(TABLE_NAME, "encrypted");
    }

    if (await hasColumn(queryInterface, TABLE_NAME, "storage_tier")) {
      await queryInterface.removeColumn(TABLE_NAME, "storage_tier");
    }
  },
};

export default migration;
