import type { QueryInterface } from "sequelize";

type MigrationDataTypes = typeof import("sequelize").DataTypes;

const migration = {
  async up(_queryInterface: QueryInterface, _Sequelize: MigrationDataTypes): Promise<void> {
    // Legacy CloudConnections/AwsCloudConnections bootstrap is intentionally disabled.
    // Final cloud schema is owned by 20260330120000-create-cloud-providers-and-cloud-connections-v2.ts.
  },

  async down(_queryInterface: QueryInterface): Promise<void> {
    // no-op
  },
};

export default migration;
