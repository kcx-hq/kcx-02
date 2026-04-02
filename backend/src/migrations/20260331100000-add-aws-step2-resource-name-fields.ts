import type { QueryInterface } from "sequelize";

type MigrationDataTypes = typeof import("sequelize").DataTypes;

const migration = {
  async up(_queryInterface: QueryInterface, _Sequelize: MigrationDataTypes): Promise<void> {
    // Legacy AwsCloudConnections step-2 resource-name migration is intentionally disabled.
  },

  async down(_queryInterface: QueryInterface): Promise<void> {
    // no-op
  },
};

export default migration;
