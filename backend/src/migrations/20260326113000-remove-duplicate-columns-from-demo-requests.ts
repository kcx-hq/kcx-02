import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn("DemoRequests", "firstName");
    await queryInterface.removeColumn("DemoRequests", "lastName");
    await queryInterface.removeColumn("DemoRequests", "companyEmail");
    await queryInterface.removeColumn("DemoRequests", "companyName");
    await queryInterface.removeColumn("DemoRequests", "heardAboutUs");
  },

  async down(
    queryInterface: QueryInterface,
    Sequelize: typeof import("sequelize").DataTypes,
  ): Promise<void> {
    await queryInterface.addColumn("DemoRequests", "firstName", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "",
    });
    await queryInterface.addColumn("DemoRequests", "lastName", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "",
    });
    await queryInterface.addColumn("DemoRequests", "companyEmail", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "",
    });
    await queryInterface.addColumn("DemoRequests", "companyName", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "",
    });
    await queryInterface.addColumn("DemoRequests", "heardAboutUs", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "",
    });
  },
};

export default migration;
