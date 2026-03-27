import type { QueryInterface } from "sequelize";

type MigrationDataTypes = typeof import("sequelize").DataTypes;

const migration = {
  async up(queryInterface: QueryInterface, Sequelize: MigrationDataTypes): Promise<void> {
    await queryInterface.addColumn("DemoRequests", "meetingUrl", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn("DemoRequests", "meetingUrl");
  },
};

export default migration;
