import type { QueryInterface } from "sequelize";

type MigrationDataTypes = typeof import("sequelize").DataTypes;

const migration = {
  async up(_queryInterface: QueryInterface, _Sequelize: MigrationDataTypes): Promise<void> {
    // Legacy augmentation migration is intentionally disabled.
    // Do not add non-v2 columns (connectionName/setupMode/isActive/last* camelCase) to cloud_connections.
  },

  async down(_queryInterface: QueryInterface): Promise<void> {
    // no-op
  },
};

export default migration;
